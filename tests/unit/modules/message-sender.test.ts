import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { WASocket } from '@whiskeysockets/baileys';

const mockRelayMessage = mock(() => Promise.resolve('msg-123'));
const mockSendMessage = mock(() =>
    Promise.resolve({ key: { id: 'msg-123' } }),
);

const mockSocket = {
    sendMessage: mockSendMessage,
    relayMessage: mockRelayMessage,
    user: { id: '5511888888888@s.whatsapp.net' },
} as unknown as WASocket;

mock.module('../../../src/modules/connection-manager.ts', () => ({
    whatsappManager: {
        ensureConnected: () => Promise.resolve(mockSocket),
    },
}));

const {
    sendTextMessage,
    sendButtonsMessage,
    sendLinkButtonMessage,
    sendBulkMessage,
    sendImageMessage,
} = await import('../../../src/modules/message-sender.ts');

const TEST_IMAGE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('modules/whatsapp/message-sender', () => {
    beforeEach(() => {
        mockSendMessage.mockClear();
        mockRelayMessage.mockClear();
    });

    test('sendTextMessage', async () => {
        const result = await sendTextMessage(1, { to: '5511999999999', text: 'Hello' });
        expect(result.success).toBe(true);
        expect(result.jid).toBe('5511999999999@s.whatsapp.net');
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockRelayMessage).toHaveBeenCalledTimes(0);
    });

    test('sendButtonsMessage uses relayMessage with quick_reply buttons', async () => {
        await sendButtonsMessage(1, {
            to: '5511999999999',
            text: 'Como posso ajudar?',
            footer: 'Thinksoft ERP',
            buttons: [
                { id: 'financeiro', text: 'Financeiro' },
                { id: 'suporte', text: 'Suporte' },
            ],
        });

        expect(mockRelayMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMessage).toHaveBeenCalledTimes(0);

        const [, message, options] = mockRelayMessage.mock.calls[0]!;
        expect(message?.interactiveMessage?.body?.text).toBe('Como posso ajudar?');
        expect(message?.interactiveMessage?.footer?.text).toBe('Thinksoft ERP');

        const buttons = message?.interactiveMessage?.nativeFlowMessage?.buttons ?? [];
        expect(buttons).toHaveLength(2);
        expect(buttons[0]?.name).toBe('quick_reply');
        expect(JSON.parse(buttons[0]?.buttonParamsJson ?? '{}')).toEqual({
            display_text: 'Financeiro',
            id: 'financeiro',
        });
        expect(options?.additionalNodes?.some((node) => node.tag === 'biz')).toBe(true);
        expect(options?.additionalNodes?.some((node) => node.tag === 'bot')).toBe(true);
    });

    test('sendButtonsMessage supports mixed quick reply and cta_url buttons', async () => {
        await sendButtonsMessage(1, {
            to: '5511999999999',
            text: 'Escolha uma opção:',
            buttons: [
                { id: 'vendas', text: 'Falar com vendedor' },
                { id: 'site', text: 'Visitar site', url: 'https://meusite.com.br' },
            ],
        });

        const [, message] = mockRelayMessage.mock.calls[0]!;
        const buttons = message?.interactiveMessage?.nativeFlowMessage?.buttons ?? [];
        expect(buttons[0]?.name).toBe('quick_reply');
        expect(buttons[1]?.name).toBe('cta_url');
    });

    test('sendLinkButtonMessage uses cta_url native flow button', async () => {
        await sendLinkButtonMessage(1, {
            to: '5511999999999',
            text: 'Acesse nosso portal:',
            footer: 'Thinksoft ERP',
            buttonText: 'Abrir Portal',
            url: 'https://portal.seusite.com.br',
        });

        expect(mockRelayMessage).toHaveBeenCalledTimes(1);
        const [, message] = mockRelayMessage.mock.calls[0]!;
        const button = message?.interactiveMessage?.nativeFlowMessage?.buttons?.[0];
        expect(button?.name).toBe('cta_url');
        expect(JSON.parse(button?.buttonParamsJson ?? '{}')).toMatchObject({
            display_text: 'Abrir Portal',
            url: 'https://portal.seusite.com.br',
            merchant_url: 'https://portal.seusite.com.br',
        });
    });

    test('sendBulkMessage handles multiple recipients', async () => {
        const results = await sendBulkMessage(1, {
            recipients: ['5511111111111', '5522222222222'],
            message: { type: 'text', text: 'Bulk hello' },
        });
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
    });

    test('sendImageMessage with imageUrl', async () => {
        const result = await sendImageMessage(1, {
            to: '5511999999999',
            imageUrl: 'https://example.com/photo.jpg',
            caption: 'Test caption',
        });
        expect(result.success).toBe(true);
        expect(result.jid).toBe('5511999999999@s.whatsapp.net');
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const call = mockSendMessage.mock.calls[0];
        expect(call?.[1]).toMatchObject({
            image: { url: 'https://example.com/photo.jpg' },
            caption: 'Test caption',
        });
    });

    test('sendImageMessage with imageBase64', async () => {
        const result = await sendImageMessage(1, {
            to: '5511999999999',
            imageBase64: TEST_IMAGE_BASE64,
        });
        expect(result.success).toBe(true);
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const call = mockSendMessage.mock.calls[0];
        expect(call?.[1]).toMatchObject({
            image: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
        });
    });
});
