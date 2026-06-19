import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    type WASocket,
    type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { env } from '../../config/env.ts';
import { useDatabaseAuthState, hasAuthenticatedCreds } from './auth-state.ts';
import {
    updateSessionState,
    clearSessionAuth,
    saveReceivedMessage,
    getSession,
} from './session-repository.ts';
import type { ConnectionInfo, LoginStatus, SocketConnectionStatus } from './types.ts';
import {
    TenantAlreadyLoggedInError,
    WhatsAppNotConnectedError,
    WhatsAppNotLoggedInError,
    WhatsAppQrPendingError,
} from './types.ts';

interface TenantConnection {
    socket: WASocket | null;
    loginStatus: LoginStatus;
    connectionStatus: SocketConnectionStatus;
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
                loginStatus: 'logged_out',
                connectionStatus: 'disconnected',
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

    private async persistSession(
        tenantId: number,
        conn: TenantConnection,
        extras?: {
            phone_number?: string | null;
            qr_code?: string | null;
            connected?: boolean;
        },
    ): Promise<void> {
        await updateSessionState(tenantId, {
            status: conn.loginStatus,
            phone_number: extras?.phone_number,
            qr_code: extras?.qr_code,
            last_connected_at: extras?.connected ? new Date() : undefined,
        });
    }

    private async resetFailedQrLogin(tenantId: number, conn: TenantConnection): Promise<void> {
        this.clearReconnectTimer(conn);
        conn.loginStatus = 'logged_out';
        conn.connectionStatus = 'disconnected';
        conn.qrCode = null;
        conn.phoneNumber = null;
        conn.connecting = false;
        await clearSessionAuth(tenantId);
    }

    private isFailedQrLogin(status: LoginStatus, connectionStatus: SocketConnectionStatus): boolean {
        return status === 'qr_pending' && connectionStatus === 'disconnected';
    }

    async connect(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        if (
            conn.socket &&
            (conn.connectionStatus === 'connected' || conn.connectionStatus === 'connecting')
        ) {
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

        await this.connect(tenantId);
        const qrCode = this.getOrCreate(tenantId).qrCode;
        if (!qrCode) {
            throw new Error('Failed to generate WhatsApp QR code');
        }

        return { qrCode };
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
        conn.connectionStatus = 'connecting';
        await this.persistSession(tenantId, conn);

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
                if (conn.connectionStatus === 'connected') return;
                clearSyncTimer();
                conn.loginStatus = 'logged_in';
                conn.connectionStatus = 'connected';
                conn.qrCode = null;
                const userJid = socket.user?.id ?? null;
                conn.phoneNumber = userJid ? userJid.split(':')[0] ?? userJid : null;
                await this.persistSession(tenantId, conn, {
                    phone_number: conn.phoneNumber,
                    qr_code: null,
                    connected: true,
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
                browser: [env.whatsappBrowserName, 'Google Chrome', '1.0.0'],
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            conn.socket = socket;
            conn.connectionStatus = 'connecting';
            conn.qrCode = null;

            socket.ev.on('creds.update', async (update) => {
                await saveCreds();
                if (
                    conn.connectionStatus === 'connecting' &&
                    typeof update.accountSyncCounter === 'number' &&
                    update.accountSyncCounter > 0
                ) {
                    await markConnected();
                }
            });

            socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;

                if (isNewLogin) {
                    conn.loginStatus = 'logged_in';
                    conn.connectionStatus = 'connecting';
                    conn.qrCode = null;
                    await this.persistSession(tenantId, conn, { qr_code: null });
                }

                if (connection === 'connecting') {
                    conn.connectionStatus = 'connecting';
                    await this.persistSession(tenantId, conn);
                }

                if (qr) {
                    conn.qrCode = qr;
                    conn.loginStatus = 'qr_pending';
                    conn.connectionStatus = 'connecting';
                    await this.persistSession(tenantId, conn, { qr_code: qr });
                    await markReady();
                }

                if (connection === 'open') {
                    conn.qrCode = null;
                    const userJid = socket.user?.id ?? null;
                    conn.phoneNumber = userJid ? userJid.split(':')[0] ?? userJid : null;

                    if ((state.creds.accountSyncCounter || 0) > 0) {
                        await markConnected();
                    } else {
                        conn.loginStatus = 'logged_in';
                        conn.connectionStatus = 'connecting';
                        await this.persistSession(tenantId, conn, {
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
                    const waitingForQr =
                        conn.loginStatus === 'qr_pending' || conn.connectionStatus === 'connecting';

                    conn.socket = null;
                    conn.connecting = false;

                    if (loggedOut) {
                        clearSyncTimer();
                        conn.loginStatus = 'logged_out';
                        conn.connectionStatus = 'disconnected';
                        conn.qrCode = null;
                        await clearSessionAuth(tenantId);
                        return;
                    }

                    if (restartRequired) {
                        conn.connectionStatus = 'connecting';
                        conn.qrCode = null;
                        await this.persistSession(tenantId, conn, { qr_code: null });
                        setImmediate(() => {
                            this.connect(tenantId).catch(() => undefined);
                        });
                        return;
                    }

                    if (waitingForQr) {
                        if (conn.qrCode || conn.loginStatus === 'qr_pending') {
                            clearSyncTimer();
                            await this.resetFailedQrLogin(tenantId, conn);
                        } else if (conn.connectionStatus !== 'connecting') {
                            clearSyncTimer();
                            conn.loginStatus = wasRegistered ? 'logged_in' : 'logged_out';
                            conn.connectionStatus = 'disconnected';
                            await this.persistSession(tenantId, conn, { qr_code: null });
                        } else {
                            await this.persistSession(tenantId, conn, { qr_code: null });
                        }
                        return;
                    }

                    clearSyncTimer();
                    conn.loginStatus = wasRegistered ? 'logged_in' : 'logged_out';
                    conn.connectionStatus = 'disconnected';
                    conn.qrCode = null;
                    await this.persistSession(tenantId, conn, { qr_code: null });

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
            conn.connectionStatus = 'disconnected';
            if (conn.loginStatus === 'qr_pending') {
                await this.resetFailedQrLogin(tenantId, conn);
            } else {
                const { state } = await useDatabaseAuthState(tenantId);
                if (!hasAuthenticatedCreds(state.creds)) {
                    conn.loginStatus = 'logged_out';
                }
                await this.persistSession(tenantId, conn);
            }
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

        conn.connectionStatus = 'disconnected';
        conn.qrCode = null;
        conn.phoneNumber = null;
        conn.connecting = false;

        await this.persistSession(tenantId, conn, { qr_code: null });
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
        conn.loginStatus = 'logged_out';
        conn.connectionStatus = 'disconnected';
        conn.qrCode = null;
        conn.phoneNumber = null;

        return this.getConnectionInfo(tenantId);
    }

    getSocket(tenantId: number): WASocket | null {
        return this.getOrCreate(tenantId).socket;
    }

    async ensureConnected(tenantId: number): Promise<WASocket> {
        const conn = this.getOrCreate(tenantId);

        if (conn.socket && conn.connectionStatus === 'connected') {
            return conn.socket;
        }

        const info = await this.getConnectionInfo(tenantId);
        if (info.status === 'qr_pending' && info.connectionStatus === 'connecting') {
            throw new WhatsAppQrPendingError();
        }

        const { state } = await useDatabaseAuthState(tenantId);
        if (!hasAuthenticatedCreds(state.creds)) {
            throw new WhatsAppNotLoggedInError();
        }

        if (conn.loginStatus === 'logged_out') {
            conn.loginStatus = 'logged_in';
        }

        if (!conn.socket || conn.connectionStatus === 'disconnected') {
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

                if (conn.socket && conn.connectionStatus === 'connected') {
                    resolve(conn.socket);
                    return;
                }

                if (conn.loginStatus === 'qr_pending' && conn.connectionStatus === 'connecting') {
                    reject(new WhatsAppQrPendingError());
                    return;
                }

                if (conn.loginStatus === 'logged_out') {
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

    private isConnectionInProgress(tenantId: number, conn: TenantConnection): boolean {
        return (
            conn.connectionStatus === 'connecting' ||
            conn.connecting ||
            this.connectPromises.has(tenantId) ||
            conn.reconnectTimer !== null
        );
    }

    private resolveConnectionStatus(
        tenantId: number,
        conn: TenantConnection,
    ): SocketConnectionStatus {
        if (conn.socket && conn.connectionStatus === 'connected') {
            return 'connected';
        }

        if (this.isConnectionInProgress(tenantId, conn)) {
            return 'connecting';
        }

        return 'disconnected';
    }

    private hasActiveLoginState(conn: TenantConnection, tenantId: number): boolean {
        if (conn.socket !== null || this.isConnectionInProgress(tenantId, conn)) {
            return true;
        }

        return conn.loginStatus === 'qr_pending' && conn.connectionStatus === 'connecting';
    }

    private reconcileLoginStatus(
        status: LoginStatus,
        hasCreds: boolean,
        phoneNumber: string | null,
    ): LoginStatus {
        if (status === 'qr_pending') {
            return 'qr_pending';
        }

        if (status === 'logged_out' && (hasCreds || phoneNumber)) {
            return 'logged_in';
        }

        if (status === 'logged_in' && !hasCreds && !phoneNumber) {
            return 'logged_out';
        }

        return status;
    }

    async verifyConnectionStatus(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);

        if (conn.socket && conn.connectionStatus === 'connected') {
            return this.getConnectionInfo(tenantId);
        }

        const { state } = await useDatabaseAuthState(tenantId);
        if (!hasAuthenticatedCreds(state.creds)) {
            return this.getConnectionInfo(tenantId);
        }

        if (conn.loginStatus === 'logged_out') {
            conn.loginStatus = 'logged_in';
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

        let status: LoginStatus;

        if (this.hasActiveLoginState(conn, tenantId)) {
            status = conn.loginStatus;
        } else if (dbSession) {
            status = dbSession.status;
        } else {
            status = 'logged_out';
        }

        const phoneNumber = conn.phoneNumber ?? dbSession?.phone_number ?? null;
        const connectionStatus = this.resolveConnectionStatus(tenantId, conn);

        const { state } = await useDatabaseAuthState(tenantId);
        const hasCreds = hasAuthenticatedCreds(state.creds);

        status = this.reconcileLoginStatus(status, hasCreds, phoneNumber);

        let resolvedPhoneNumber = phoneNumber;
        if (this.isFailedQrLogin(status, connectionStatus)) {
            await this.resetFailedQrLogin(tenantId, conn);
            status = 'logged_out';
            resolvedPhoneNumber = null;
        }

        return {
            status,
            connectionStatus: this.resolveConnectionStatus(tenantId, conn),
            phoneNumber: resolvedPhoneNumber,
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
        return !!conn?.socket && conn.connectionStatus === 'connected';
    }
}

export const whatsappManager = new WhatsAppConnectionManager();
