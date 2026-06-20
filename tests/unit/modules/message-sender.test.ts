import { describe, expect, test, mock, beforeEach } from 'bun:test';
import type { BinaryNode, proto, WASocket } from '@whiskeysockets/baileys';
import type { SendResult } from '../../../src/modules/types.ts';
import { testJid, testPhone } from '../../helpers/phone.ts';

type RelayMessageArgs = [
    string,
    proto.IMessage,
    { messageId?: string; additionalNodes?: BinaryNode[] },
];

const mockRelayMessage = mock((_jid: string, _message: proto.IMessage, _options?: RelayMessageArgs[2]) =>
    Promise.resolve('msg-123'),
);
const mockSendMessage = mock((_jid: string, _content: unknown) =>
    Promise.resolve({ key: { id: 'msg-123' } }),
);

const mockSocket = {
    sendMessage: mockSendMessage,
    relayMessage: mockRelayMessage,
    user: { id: testJid },
} as unknown as WASocket;

mock.module('../../../src/modules/connection-manager.ts', () => ({
    whatsappManager: {
        ensureConnected: () => Promise.resolve(mockSocket),
    },
}));

const {
    sendTextMessage,
    sendLinkMessage,
    sendLinkButtonMessage,
    sendBulkMessage,
    sendImageMessage,
} = await import('../../../src/modules/message-sender.ts');

const TEST_IMAGE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function expectSendResult(result: SendResult, expectedMessageId = 'msg-123'): void {
    expect(result.to).toBe(testPhone);
    expect(result.jid).toBe(testJid);
    expect(result.messageId).toBe(expectedMessageId);
    expect(result.success).toBe(true);
}

function expectGeneratedSendResult(result: SendResult): void {
    expect(result.to).toBe(testPhone);
    expect(result.jid).toBe(testJid);
    expect(result.messageId).toBeDefined();
    expect(result.messageId!.length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
}

describe('modules/whatsapp/message-sender', () => {
    beforeEach(() => {
        mockSendMessage.mockClear();
        mockRelayMessage.mockClear();
    });

    test('sendTextMessage returns SendResult', async () => {
        const result = await sendTextMessage(1, { to: testPhone, text: 'Hello' });
        expectSendResult(result);
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        expect(mockRelayMessage).toHaveBeenCalledTimes(0);
    });

    test('sendLinkMessage returns SendResult', async () => {
        const result = await sendLinkMessage(1, {
            to: testPhone,
            text: 'https://github.com/belizariogr/whatsapp-api',
        });
        expectSendResult(result);
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    test('sendLinkButtonMessage uses cta_url native flow button', async () => {
        const result = await sendLinkButtonMessage(1, {
            to: testPhone,
            text: 'Acesse nosso portal:',
            footer: 'Thinksoft ERP',
            buttonText: 'Abrir Portal',
            url: 'https://github.com/belizariogr/whatsapp-api',
        });

        expectGeneratedSendResult(result);
        expect(mockRelayMessage).toHaveBeenCalledTimes(1);
        expect(mockSendMessage).toHaveBeenCalledTimes(0);
        const [, message, options] = mockRelayMessage.mock.calls[0] as RelayMessageArgs;
        const button = message.interactiveMessage?.nativeFlowMessage?.buttons?.[0];
        expect(button?.name).toBe('cta_url');
        expect(JSON.parse(button?.buttonParamsJson ?? '{}')).toMatchObject({
            display_text: 'Abrir Portal',
            url: 'https://github.com/belizariogr/whatsapp-api',
            merchant_url: 'https://github.com/belizariogr/whatsapp-api',
        });
        expect(options.additionalNodes?.some((node) => node.tag === 'biz')).toBe(true);
        expect(options.additionalNodes?.some((node) => node.tag === 'bot')).toBe(true);
    });

    test('sendBulkMessage handles text type', async () => {
        const results = await sendBulkMessage(1, {
            recipients: [testPhone],
            message: { type: 'text', text: 'Bulk hello' },
        });
        expect(results).toHaveLength(1);
        expectSendResult(results[0]!);
    });

    test('sendBulkMessage handles link type', async () => {
        const results = await sendBulkMessage(1, {
            recipients: [testPhone],
            message: { type: 'link', text: 'https://github.com/belizariogr/whatsapp-api' },
        });
        expect(results).toHaveLength(1);
        expectSendResult(results[0]!);
    });

    test('sendBulkMessage handles image type', async () => {
        const results = await sendBulkMessage(1, {
            recipients: [testPhone],
            message: {
                type: 'image',
                imageUrl: 'https://boagestao.com/_astro/logo.Cbk95yqq.svg',
                caption: 'Bulk image',
            },
        });
        expect(results).toHaveLength(1);
        expectSendResult(results[0]!);
    });

    test('sendBulkMessage handles link_button type', async () => {
        const results = await sendBulkMessage(1, {
            recipients: [testPhone],
            message: {
                type: 'link_button',
                text: 'Clique abaixo',
                buttonText: 'Abrir',
                url: 'https://github.com/belizariogr/whatsapp-api',
            },
        });
        expect(results).toHaveLength(1);
        expectGeneratedSendResult(results[0]!);
    });

    test('sendImageMessage with imageUrl', async () => {
        const result = await sendImageMessage(1, {
            to: testPhone,
            imageUrl: 'https://boagestao.com/_astro/logo.Cbk95yqq.svg',
            caption: 'Test caption',
        });
        expectSendResult(result);
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const call = mockSendMessage.mock.calls[0] as [string, { image: { url: string }; caption: string }];
        expect(call[1]).toMatchObject({
            image: { url: 'https://boagestao.com/_astro/logo.Cbk95yqq.svg' },
            caption: 'Test caption',
        });
    });

    test('sendImageMessage with imageBase64', async () => {
        const result = await sendImageMessage(1, {
            to: testPhone,
            imageBase64: TEST_IMAGE_BASE64,
        });
        expectSendResult(result);
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
        const call = mockSendMessage.mock.calls[0] as [string, { image: Buffer }];
        expect(call[1]).toMatchObject({
            image: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
        });
    });
});
