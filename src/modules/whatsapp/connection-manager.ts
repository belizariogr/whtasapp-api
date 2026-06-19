import makeWASocket, {
    Browsers,
    DisconnectReason,
    fetchLatestBaileysVersion,
    type WASocket,
    type WAMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { env } from '../../config/env.ts';
import { useDatabaseAuthState } from './auth-state.ts';
import {
    updateSessionStatus,
    clearSessionAuth,
    saveReceivedMessage,
    getSession,
} from './session-repository.ts';
import type { ConnectionInfo, ConnectionStatus } from './types.ts';

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

        if (conn.socket && conn.status === 'connected') {
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
            const wasRegistered = Boolean(state.creds.registered);
            const { version } = await fetchLatestBaileysVersion();

            let resolveReady: ((info: ConnectionInfo) => void) | null = null;
            let rejectReady: ((error: Error) => void) | null = null;
            let readyResolved = false;

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
                browser: Browsers.baileys(env.whatsappBrowserName),
                printQRInTerminal: false,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            conn.socket = socket;
            conn.status = 'connecting';
            conn.qrCode = null;

            socket.ev.on('creds.update', saveCreds);

            socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    conn.qrCode = qr;
                    conn.status = 'qr_pending';
                    await updateSessionStatus(tenantId, 'qr_pending', { qr_code: qr });
                    await markReady();
                }

                if (connection === 'open') {
                    conn.status = 'connected';
                    conn.qrCode = null;
                    const userJid = socket.user?.id ?? null;
                    conn.phoneNumber = userJid ? userJid.split(':')[0] ?? userJid : null;
                    await updateSessionStatus(tenantId, 'connected', {
                        phone_number: conn.phoneNumber,
                        qr_code: null,
                    });
                    await markReady();
                }

                if (connection === 'close') {
                    if (conn.replacingSocket) {
                        conn.replacingSocket = false;
                        return;
                    }

                    const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
                    const loggedOut = statusCode === DisconnectReason.loggedOut;
                    const waitingForQr = conn.status === 'qr_pending' || conn.status === 'connecting';

                    conn.socket = null;
                    conn.connecting = false;

                    if (loggedOut) {
                        conn.status = 'logged_out';
                        conn.qrCode = null;
                        await clearSessionAuth(tenantId);
                        await updateSessionStatus(tenantId, 'logged_out', { qr_code: null });
                        return;
                    }

                    if (waitingForQr) {
                        conn.status = conn.qrCode ? 'qr_pending' : 'disconnected';
                        if (!conn.qrCode) {
                            await updateSessionStatus(tenantId, 'disconnected', { qr_code: null });
                        }
                        return;
                    }

                    conn.status = 'disconnected';
                    conn.qrCode = null;
                    await updateSessionStatus(tenantId, 'disconnected', { qr_code: null });

                    if (wasRegistered) {
                        this.scheduleReconnect(tenantId, conn);
                    }
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

    private isActivelyConnecting(conn: TenantConnection): boolean {
        return (
            conn.socket !== null &&
            (conn.status === 'connecting' || conn.status === 'qr_pending')
        );
    }

    async getConnectionInfo(tenantId: number): Promise<ConnectionInfo> {
        const conn = this.getOrCreate(tenantId);
        const dbSession = await getSession(tenantId);
        const activelyConnecting = this.isActivelyConnecting(conn);

        let status =
            conn.status !== 'disconnected' || !dbSession
                ? conn.status
                : (dbSession.status as ConnectionStatus);

        if (!activelyConnecting && status === 'qr_pending') {
            status = 'disconnected';
        }

        return {
            status,
            phoneNumber: conn.phoneNumber ?? dbSession?.phone_number ?? null,
            qrCode: activelyConnecting ? conn.qrCode : null,
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
