import { normalizeMessageContent, type WAMessage } from '@whiskeysockets/baileys';

export type ParsedReceivedMessage = {
    messageType: string;
    content: string | null;
};

export function parseReceivedMessage(msg: WAMessage): ParsedReceivedMessage | null {
    const normalized = normalizeMessageContent(msg.message ?? undefined);
    if (!normalized) {
        return null;
    }

    const messageType = Object.keys(normalized)[0] ?? 'unknown';
    const content =
        normalized.conversation ??
        normalized.extendedTextMessage?.text ??
        normalized.imageMessage?.caption ??
        null;

    return { messageType, content };
}
