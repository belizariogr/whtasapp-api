import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { WASocket } from '@whiskeysockets/baileys';

const mockSendMessage = mock(() =>
    Promise.resolve({ key: { id: 'msg-123' } }),
);

const mockSocket = {
    sendMessage: mockSendMessage,
} as unknown as WASocket;

mock.module('../../../src/modules/whatsapp/connection-manager', () => ({
    whatsappManager: {
        ensureConnected: () => Promise.resolve(mockSocket),
    },
}));

const { sendTextMessage, sendButtonsMessage, sendBulkMessage } = await import(
    '../../../src/modules/message-sender.ts'
);

describe('modules/whatsapp/message-sender', () => {
    beforeEach(() => {
        mockSendMessage.mockClear();
    });

    test('sendTextMessage', async () => {
        const result = await sendTextMessage(1, { to: '5511999999999', text: 'Hello' });
        expect(result.success).toBe(true);
        expect(result.jid).toBe('5511999999999@s.whatsapp.net');
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    test('sendButtonsMessage builds interactiveButtons', async () => {
        await sendButtonsMessage(1, {
            to: '5511999999999',
            text: 'Choose',
            buttons: [{ id: 'a', text: 'Option A' }],
        });
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const call = mockSendMessage.mock.calls[0];
        expect(call).toBeDefined();
    });

    test('sendBulkMessage handles multiple recipients', async () => {
        const results = await sendBulkMessage(1, {
            recipients: ['5511111111111', '5522222222222'],
            message: { type: 'text', text: 'Bulk hello' },
        });
        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
    });
});
