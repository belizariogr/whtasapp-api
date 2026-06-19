import type { AnyMessageContent, WASocket } from '@whiskeysockets/baileys';
import { whatsappManager } from './connection-manager.ts';
import { toWhatsAppJid, toWhatsAppJids } from '../../utils/phone.ts';
import type {
    SendBulkPayload,
    SendButtonsPayload,
    SendImagePayload,
    SendLinkButtonPayload,
    SendLinkPayload,
    SendResult,
    SendTextPayload,
} from './types.ts';

async function ensureConnected(tenantId: number): Promise<WASocket> {
    return whatsappManager.ensureConnected(tenantId);
}

function buildQuickReplyButtons(buttons: SendButtonsPayload['buttons']) {
    return buttons.map((btn) => ({
        name: 'quick_reply' as const,
        buttonParamsJson: JSON.stringify({
            display_text: btn.text,
            id: btn.id,
        }),
    }));
}

export async function sendTextMessage(
    tenantId: number,
    payload: SendTextPayload,
): Promise<SendResult> {
    const socket = await ensureConnected(tenantId);
    const jid = toWhatsAppJid(payload.to);
    const result = await socket.sendMessage(jid, { text: payload.text });
    return {
        to: payload.to,
        jid,
        messageId: result?.key.id ?? undefined,
        success: true,
    };
}

export async function sendLinkMessage(
    tenantId: number,
    payload: SendLinkPayload,
): Promise<SendResult> {
    const socket = await ensureConnected(tenantId);
    const jid = toWhatsAppJid(payload.to);
    const result = await socket.sendMessage(jid, {
        text: payload.text,
    });
    return {
        to: payload.to,
        jid,
        messageId: result?.key.id ?? undefined,
        success: true,
    };
}

export async function sendImageMessage(
    tenantId: number,
    payload: SendImagePayload,
): Promise<SendResult> {
    const socket = await ensureConnected(tenantId);
    const jid = toWhatsAppJid(payload.to);

    let imageContent: AnyMessageContent;
    if (payload.imageUrl) {
        imageContent = {
            image: { url: payload.imageUrl },
            caption: payload.caption,
        };
    } else if (payload.imageBase64) {
        const buffer = Buffer.from(payload.imageBase64, 'base64');
        imageContent = {
            image: buffer,
            caption: payload.caption,
        };
    } else {
        throw new Error('Either imageUrl or imageBase64 is required');
    }

    const result = await socket.sendMessage(jid, imageContent);
    return {
        to: payload.to,
        jid,
        messageId: result?.key.id ?? undefined,
        success: true,
    };
}

export async function sendButtonsMessage(
    tenantId: number,
    payload: SendButtonsPayload,
): Promise<SendResult> {
    const socket = await ensureConnected(tenantId);
    const jid = toWhatsAppJid(payload.to);

    const result = await socket.sendMessage(jid, {
        text: payload.text,
        footer: payload.footer,
        interactiveButtons: buildQuickReplyButtons(payload.buttons),
    } as AnyMessageContent);

    return {
        to: payload.to,
        jid,
        messageId: result?.key.id ?? undefined,
        success: true,
    };
}

export async function sendLinkButtonMessage(
    tenantId: number,
    payload: SendLinkButtonPayload,
): Promise<SendResult> {
    const socket = await ensureConnected(tenantId);
    const jid = toWhatsAppJid(payload.to);

    const result = await socket.sendMessage(jid, {
        text: payload.text,
        footer: payload.footer,
        interactiveButtons: [
            {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: payload.buttonText,
                    url: payload.url,
                    merchant_url: payload.url,
                }),
            },
        ],
    } as AnyMessageContent);

    return {
        to: payload.to,
        jid,
        messageId: result?.key.id ?? undefined,
        success: true,
    };
}

export async function sendBulkMessage(
    tenantId: number,
    payload: SendBulkPayload,
): Promise<SendResult[]> {
    const jids = toWhatsAppJids(payload.recipients);
    const results: SendResult[] = [];

    for (let i = 0; i < payload.recipients.length; i++) {
        const recipient = payload.recipients[i]!;
        const jid = jids[i]!;

        try {
            let result: SendResult;
            switch (payload.message.type) {
                case 'text':
                    result = await sendTextMessage(tenantId, {
                        to: recipient,
                        text: payload.message.text ?? '',
                    });
                    break;
                case 'link':
                    result = await sendLinkMessage(tenantId, {
                        to: recipient,
                        text: payload.message.text ?? '',
                    });
                    break;
                case 'image':
                    result = await sendImageMessage(tenantId, {
                        to: recipient,
                        imageUrl: payload.message.imageUrl,
                        imageBase64: payload.message.imageBase64,
                        caption: payload.message.caption,
                    });
                    break;
                case 'buttons':
                    result = await sendButtonsMessage(tenantId, {
                        to: recipient,
                        text: payload.message.text ?? '',
                        footer: payload.message.footer,
                        buttons: payload.message.buttons ?? [],
                    });
                    break;
                case 'link_button':
                    result = await sendLinkButtonMessage(tenantId, {
                        to: recipient,
                        text: payload.message.text ?? '',
                        footer: payload.message.footer,
                        buttonText: payload.message.buttonText ?? 'Abrir link',
                        url: payload.message.url ?? '',
                    });
                    break;
                default:
                    throw new Error(`Unsupported message type: ${payload.message.type}`);
            }
            results.push(result);
        } catch (error) {
            results.push({
                to: recipient,
                jid,
                messageId: undefined,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}
