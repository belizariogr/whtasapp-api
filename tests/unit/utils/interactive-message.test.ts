import { describe, expect, test } from 'bun:test';
import {
    buildCtaUrlButton,
    buildInteractiveAdditionalNodes,
    buildInteractiveMessageContent,
    isPrivateChat,
} from '../../../src/utils/interactive-message.ts';
import { testJid, testLid } from '../../helpers/phone.ts';

describe('utils/interactive-message', () => {
    test('buildCtaUrlButton', () => {
        const button = buildCtaUrlButton('Abrir Portal', 'https://portal.example.com');
        expect(button.name).toBe('cta_url');
        expect(JSON.parse(button.buttonParamsJson)).toEqual({
            display_text: 'Abrir Portal',
            url: 'https://portal.example.com',
            merchant_url: 'https://portal.example.com',
        });
    });

    test('buildInteractiveMessageContent', () => {
        const message = buildInteractiveMessageContent({
            text: 'Acesse nosso portal:',
            footer: 'Rodapé',
            buttons: [buildCtaUrlButton('Abrir Portal', 'https://portal.example.com')],
        });

        expect(message.interactiveMessage?.body?.text).toBe('Acesse nosso portal:');
        expect(message.interactiveMessage?.footer?.text).toBe('Rodapé');
        expect(message.interactiveMessage?.nativeFlowMessage?.buttons).toHaveLength(1);
    });

    test('isPrivateChat', () => {
        expect(isPrivateChat(testJid)).toBe(true);
        expect(isPrivateChat(testLid)).toBe(true);
        expect(isPrivateChat('120363000000000000@g.us')).toBe(false);
    });

    test('buildInteractiveAdditionalNodes adds bot node for private chats', () => {
        const privateNodes = buildInteractiveAdditionalNodes(testJid);
        expect(privateNodes.some((node) => node.tag === 'biz')).toBe(true);
        expect(privateNodes.some((node) => node.tag === 'bot')).toBe(true);

        const groupNodes = buildInteractiveAdditionalNodes('120363000000000000@g.us');
        expect(groupNodes.some((node) => node.tag === 'biz')).toBe(true);
        expect(groupNodes.some((node) => node.tag === 'bot')).toBe(false);
    });
});
