import { describe, expect, test } from 'bun:test';
import type { WAMessage } from '@whiskeysockets/baileys';
import { parseReceivedMessage } from '../../../src/utils/message-content.ts';

describe('utils/message-content', () => {
    test('parseReceivedMessage extracts plain text', () => {
        const msg = {
            key: { remoteJid: '5511999999999@s.whatsapp.net', id: '1' },
            message: { conversation: 'Olá' },
        } as WAMessage;

        expect(parseReceivedMessage(msg)).toEqual({
            messageType: 'conversation',
            content: 'Olá',
        });
    });
});
