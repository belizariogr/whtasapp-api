import makeWASocket, {
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion,
    type WASocket,
    type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { env } from '../../config/env.ts';
import { useDatabaseAuthState, hasAuthenticatedCreds } from './auth-state.ts';
import {
    updateSessionStatus,
    clearSessionAuth,
    saveReceivedMessage,
    getSession,
} from './session-repository.ts';
import type { ConnectionInfo, ConnectionStatus } from './types.ts';
import {
    TenantAlreadyLoggedInError,
    WhatsAppNotConnectedError,
    WhatsAppNotLoggedInError,
} from './types.ts';

interface TenantConnection {
    socket: WASocket | null;
    status: ConnectionStatus;
    qrCode: string | null;
    phoneNumber: string | null;
    connecting: boolean;
    replacingSocket: boolean;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const CONNECT_READY_TIMEOUT_MS = 60_000;
const RECONNECT_DELAY_MS = 3_000;
/** Fallback se o Baileys não sinalizar fim da sincronização (histórico grande). */
const SYNC_COMPLETE_FALLBACK_MS = 120_000;
const MESSAGE_CONNECT_TIMEOUT_MS = SYNC_COMPLETE_FALLBACK_MS + CONNECT_READY_TIMEOUT_MS;

/** Suprime logs verbosos do Baileys (pino info) no console da API. */
const baileysLogger = {
    level: 'silent',
    trace: () => undefined,
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => baileysLogger,
};

class WhatsAppConnectionManager {
    private connections = new Map<number, TenantConnection>();
    private connectPromises = new Map<number, Promise<ConnectionInfo>>();

    private getOrCreate(tenantId: number): TenantConnection {
        let conn = this.connections.get(tenantId);
        if (!conn) {
            conn = {
                socket: null,
                status: 'disconnected',
                qrCode: null,
                phoneNumber: null,
                connecting: false,
                replacingSocket: false,
                reconnectTimer: null,
            };
            this.connections.set(tenantId, conn);
        }
        return conn;
    }

    async connect(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        if (conn.socket && (conn.status === 'connected' || conn.status === 'connecting')) {
            return this.getConnectionInfo(tenantId);
        }

        const inFlight = this.connectPromises.get(tenantId);
        if (inFlight) {
            return inFlight;
        }

        const promise = this.startConnect(tenantId);
        this.connectPromises.set(tenantId, promise);

        try {
            return await promise;
        } finally {
            this.connectPromises.delete(tenantId);
        }
    }

    async login(tenantId: number): Promise<{ qrCode: string }> {
        const { state } = await useDatabaseAuthState(tenantId);
        if (hasAuthenticatedCreds(state.creds)) {
            throw new TenantAlreadyLoggedInError();
        }

        const info = await this.connect(tenantId);
        if (!info.qrCode) {
            throw new Error('Failed to generate WhatsApp QR code');
        }

        return { qrCode: info.qrCode };
    }

    private clearReconnectTimer(conn: TenantConnection): void {
        if (conn.reconnectTimer) {
            clearTimeout(conn.reconnectTimer);
            conn.reconnectTimer = null;
        }
    }

    private scheduleReconnect(tenantId: number, conn: TenantConnection): void {
        this.clearReconnectTimer(conn);
        conn.reconnectTimer = setTimeout(() => {
            conn.reconnectTimer = null;
            this.connect(tenantId).catch(() => undefined);
        }, RECONNECT_DELAY_MS);
    }

    private async startConnect(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        conn.connecting = true;
        this.clearReconnectTimer(conn);
        await updateSessionStatus(tenantId, 'connecting');

        try {
            if (conn.socket) {
                conn.replacingSocket = true;
                conn.socket.end(undefined);
                conn.socket = null;
            }

            const { state, saveCreds } = await useDatabaseAuthState(tenantId);
            const wasRegistered = hasAuthenticatedCreds(state.creds);
            const { version } = await fetchLatestBaileysVersion();

            let resolveReady: ((info: ConnectionInfo) => void) | null = null;
            let rejectReady: ((error: Error) => void) | null = null;
            let readyResolved = false;

            let syncCompleteTimer: ReturnType<typeof setTimeout> | null = null;

            const clearSyncTimer = () => {
                if (!syncCompleteTimer) return;
                clearTimeout(syncCompleteTimer);
                syncCompleteTimer = null;
            };

            const markConnected = async () => {
                if (conn.status === 'connected') return;
                clearSyncTimer();
                conn.status = 'connected';
                conn.qrCode = null;
                const userJid = socket.user?.id ?? null;
                conn.phoneNumber = userJid ? userJid.split(':')[0] ?? userJid : null;
                await updateSessionStatus(tenantId, 'connected', {
                    phone_number: conn.phoneNumber,
                    qr_code: null,
                });
            };

            const markReady = async () => {
                if (readyResolved) return;
                readyResolved = true;
                clearTimeout(timeout);
                resolveReady?.(await this.getConnectionInfo(tenantId));
            };

            const readyPromise = new Promise<ConnectionInfo>((resolve, reject) => {
                resolveReady = resolve;
                rejectReady = reject;
            });

            const timeout = setTimeout(() => {
                if (readyResolved) return;
                readyResolved = true;
                rejectReady?.(
                    new Error('Timeout waiting for QR code or WhatsApp connection'),
                );
            }, CONNECT_READY_TIMEOUT_MS);

            const socket = makeWASocket({
                version,
                auth: state,
                logger: baileysLogger,
                browser: [env.whatsappBrowserName, "Google Chrome", "1.0.0"],
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            conn.socket = socket;
            conn.status = 'connecting';
            conn.qrCode = null;

            socket.ev.on('creds.update', async (update) => {
                await saveCreds();
                if (
                    conn.status === 'connecting' &&
                    typeof update.accountSyncCounter === 'number' &&
                    update.accountSyncCounter > 0
                ) {
                    await markConnected();
                }
            });

            socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;

                if (isNewLogin) {
                    conn.status = 'connecting';
                    conn.qrCode = null;
                    await updateSessionStatus(tenantId, 'connecting', { qr_code: null });
                }

                if (connection === 'connecting') {
                    conn.status = 'connecting';
                    await updateSessionStatus(tenantId, 'connecting');
                }

                if (qr) {
                    conn.qrCode = qr;
                    conn.status = 'qr_pending';
                    await updateSessionStatus(tenantId, 'qr_pending', { qr_code: qr });
                    await markReady();
                }

                if (connection === 'open') {
                    conn.qrCode = null;
                    const userJid = socket.user?.id ?? null;
                    conn.phoneNumber = userJid ? userJid.split(':')[0] ?? userJid : null;

                    if ((state.creds.accountSyncCounter || 0) > 0) {
                        await markConnected();
                    } else {
                        conn.status = 'connecting';
                        await updateSessionStatus(tenantId, 'connecting', {
                            phone_number: conn.phoneNumber,
                            qr_code: null,
                        });
                        clearSyncTimer();
                        syncCompleteTimer = setTimeout(() => {
                            void markConnected();
                        }, SYNC_COMPLETE_FALLBACK_MS);
                    }

                    await markReady();
                }

                if (connection === 'close') {
                    if (conn.replacingSocket) {
                        conn.replacingSocket = false;
                        return;
                    }

                    const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
                    const loggedOut = statusCode === DisconnectReason.loggedOut;
                    const restartRequired = statusCode === DisconnectReason.restartRequired;
                    const waitingForQr = conn.status === 'qr_pending' || conn.status === 'connecting';

                    conn.socket = null;
                    conn.connecting = false;

                    if (loggedOut) {
                        clearSyncTimer();
                        conn.status = 'logged_out';
                        conn.qrCode = null;
                        await clearSessionAuth(tenantId);
                        await updateSessionStatus(tenantId, 'logged_out', { qr_code: null });
                        return;
                    }

                    if (restartRequired) {
                        conn.status = 'connecting';
                        conn.qrCode = null;
                        await updateSessionStatus(tenantId, 'connecting', { qr_code: null });
                        setImmediate(() => {
                            this.connect(tenantId).catch(() => undefined);
                        });
                        return;
                    }

                    if (waitingForQr) {
                        if (conn.qrCode) {
                            conn.status = 'qr_pending';
                        } else if (conn.status !== 'connecting') {
                            clearSyncTimer();
                            conn.status = 'disconnected';
                            await updateSessionStatus(tenantId, 'disconnected', { qr_code: null });
                        } else {
                            await updateSessionStatus(tenantId, 'connecting', { qr_code: null });
                        }
                        return;
                    }

                    clearSyncTimer();
                    conn.status = 'disconnected';
                    conn.qrCode = null;
                    await updateSessionStatus(tenantId, 'disconnected', { qr_code: null });

                    if (wasRegistered) {
                        this.scheduleReconnect(tenantId, conn);
                    }
                }
            });

            socket.ev.on('messaging-history.status', async ({ status }) => {
                if (status === 'complete' || status === 'paused') {
                    await markConnected();
                }
            });

            socket.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify') return;
                for (const msg of messages) {
                    await this.handleIncomingMessage(tenantId, msg);
                }
            });

            return await readyPromise;
        } catch (error) {
            conn.connecting = false;
            conn.status = 'disconnected';
            await updateSessionStatus(tenantId, 'disconnected');
            throw error;
        } finally {
            conn.connecting = false;
        }
    }

    async disconnect(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        this.clearReconnectTimer(conn);

        if (conn.socket) {
            conn.replacingSocket = true;
            conn.socket.end(undefined);
            conn.socket = null;
        }

        conn.status = 'disconnected';
        conn.qrCode = null;
        conn.phoneNumber = null;
        conn.connecting = false;

        await updateSessionStatus(tenantId, 'disconnected', { qr_code: null });
        return this.getConnectionInfo(tenantId);
    }

    async logout(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        this.clearReconnectTimer(conn);

        if (conn.socket) {
            await conn.socket.logout();
            conn.socket = null;
        }

        await clearSessionAuth(tenantId);
        conn.status = 'logged_out';
        conn.qrCode = null;
        conn.phoneNumber = null;

        return this.getConnectionInfo(tenantId);
    }

    getSocket(tenantId: number): WASocket | null {
        return this.getOrCreate(tenantId).socket;
    }

    async ensureConnected(tenantId: number): Promise<WASocket> {
        const conn = this.getOrCreate(tenantId);

        if (conn.socket && conn.status === 'connected') {
            return conn.socket;
        }

        const { state } = await useDatabaseAuthState(tenantId);
        if (!hasAuthenticatedCreds(state.creds)) {
            throw new WhatsAppNotLoggedInError();
        }

        if (conn.status === 'logged_out') {
            conn.status = 'disconnected';
        }

        if (!conn.socket || conn.status === 'disconnected') {
            await this.connect(tenantId);
        }

        return this.waitForConnectedSocket(tenantId);
    }

    private waitForConnectedSocket(
        tenantId: number,
        timeoutMs = MESSAGE_CONNECT_TIMEOUT_MS,
    ): Promise<WASocket> {
        return new Promise((resolve, reject) => {
            const deadline = Date.now() + timeoutMs;

            const poll = () => {
                const conn = this.getOrCreate(tenantId);

                if (conn.socket && conn.status === 'connected') {
                    resolve(conn.socket);
                    return;
                }

                if (conn.status === 'qr_pending') {
                    reject(
                        new WhatsAppNotLoggedInError(
                            'WhatsApp session requires QR pairing. Call POST /whatsapp/login first.',
                        ),
                    );
                    return;
                }

                if (conn.status === 'logged_out' || conn.status === 'disconnected') {
                    reject(new WhatsAppNotLoggedInError());
                    return;
                }

                if (Date.now() >= deadline) {
                    reject(new WhatsAppNotConnectedError('Timeout waiting for WhatsApp connection'));
                    return;
                }

                setTimeout(poll, 500);
            };

            poll();
        });
    }

    private isActivelyConnecting(conn: TenantConnection): boolean {
        return (
            conn.socket !== null &&
            (conn.status === 'connecting' || conn.status === 'qr_pending')
        );
    }

    private isConnectionInProgress(tenantId: number, conn: TenantConnection): boolean {
        return (
            conn.status === 'connecting' ||
            conn.connecting ||
            this.connectPromises.has(tenantId) ||
            conn.reconnectTimer !== null
        );
    }

    async verifyConnectionStatus(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        if (conn.socket && conn.status === 'connected') {
            return this.getConnectionInfo(tenantId);
        }

        const { state } = await useDatabaseAuthState(tenantId);
        if (!hasAuthenticatedCreds(state.creds)) {
            return this.getConnectionInfo(tenantId);
        }

        if (conn.status === 'logged_out') {
            conn.status = 'disconnected';
        }

        try {
            await this.connect(tenantId);
        } catch {
            // Timeout or transient failure — return best-known status.
        }

        return this.getConnectionInfo(tenantId);
    }

    async getConnectionInfo(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);
        const dbSession = await getSession(tenantId);
        const activelyConnecting = this.isActivelyConnecting(conn);

        let status: ConnectionStatus;

        if (conn.status !== 'disconnected' && conn.status !== 'logged_out') {
            status = conn.status;
        } else if (this.isConnectionInProgress(tenantId, conn)) {
            status = 'connecting';
        } else if (dbSession) {
            status = dbSession.status as ConnectionStatus;
            if (status === 'qr_pending' || status === 'connecting') {
                status = 'disconnected';
            }
        } else {
            status = 'disconnected';
        }

        if (!activelyConnecting && status === 'qr_pending') {
            status = 'disconnected';
        }

        return {
            status,
            phoneNumber: conn.phoneNumber ?? dbSession?.phone_number ?? null,
            qrCode: activelyConnecting && conn.status === 'qr_pending' ? conn.qrCode : null,
            isConnected: status === 'connected' && conn.socket !== null,
            lastConnectedAt: dbSession?.last_connected_at
                ? new Date(dbSession.last_connected_at).toISOString()
                : null,
        };
    }

    private async handleIncomingMessage(tenantId: number, msg: WAMessage): Promise<void> {
        if (msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const messageId = msg.key.id;
        if (!remoteJid || !messageId) return;

        const content =
            msg.message?.conversation ??
            msg.message?.extendedTextMessage?.text ??
            msg.message?.imageMessage?.caption ??
            null;

        const messageType = Object.keys(msg.message ?? {})[0] ?? 'unknown';

        await saveReceivedMessage(tenantId, remoteJid, messageId, messageType, content);
    }

    /** Expõe conexões ativas — útil para testes */
    hasActiveConnection(tenantId: number): boolean {
        const conn = this.connections.get(tenantId);
        return !!conn?.socket && conn.status === 'connected';
    }
}

export const whatsappManager = new WhatsAppConnectionManager();
