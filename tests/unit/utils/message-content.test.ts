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

    test('parseReceivedMessage extracts quick reply id from interactiveResponseMessage', () => {
        const msg = {
            key: { remoteJid: '5511999999999@s.whatsapp.net', id: '2' },
            message: {
                interactiveResponseMessage: {
                    nativeFlowResponseMessage: {
                        name: 'quick_reply',
                        paramsJson: JSON.stringify({ id: 'financeiro' }),
                    },
                },
            },
        } as WAMessage;

        expect(parseReceivedMessage(msg)).toEqual({
            messageType: 'interactiveResponseMessage',
            content: 'financeiro',
            buttonId: 'financeiro',
        });
    });

    test('parseReceivedMessage extracts id from buttonsResponseMessage', () => {
        const msg = {
            key: { remoteJid: '5511999999999@s.whatsapp.net', id: '3' },
            message: {
                buttonsResponseMessage: {
                    selectedButtonId: 'suporte',
                    selectedDisplayText: 'Suporte',
                },
            },
        } as WAMessage;

        expect(parseReceivedMessage(msg)).toEqual({
            messageType: 'buttonsResponseMessage',
            content: 'suporte',
            buttonId: 'suporte',
        });
    });
});
