import { describe, expect, test } from 'bun:test';
import {
    buildCtaUrlButton,
    buildInteractiveAdditionalNodes,
    buildInteractiveMessageContent,
    buildNativeFlowButton,
    buildNativeFlowButtons,
    buildQuickReplyButton,
    isPrivateChat,
} from '../../../src/utils/interactive-message.ts';

describe('utils/interactive-message', () => {
    test('buildQuickReplyButton', () => {
        const button = buildQuickReplyButton('opt_a', 'Option A');
        expect(button.name).toBe('quick_reply');
        expect(JSON.parse(button.buttonParamsJson)).toEqual({
            display_text: 'Option A',
            id: 'opt_a',
        });
    });

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
            text: 'Escolha uma opção',
            footer: 'Rodapé',
            buttons: [buildQuickReplyButton('a', 'A')],
        });

        expect(message.interactiveMessage?.body?.text).toBe('Escolha uma opção');
        expect(message.interactiveMessage?.footer?.text).toBe('Rodapé');
        expect(message.interactiveMessage?.nativeFlowMessage?.buttons).toHaveLength(1);
    });

    test('isPrivateChat', () => {
        expect(isPrivateChat('5511999999999@s.whatsapp.net')).toBe(true);
        expect(isPrivateChat('120363000000000000@g.us')).toBe(false);
    });

    test('buildInteractiveAdditionalNodes adds bot node for private chats', () => {
        const privateNodes = buildInteractiveAdditionalNodes('5511999999999@s.whatsapp.net');
        expect(privateNodes.some((node) => node.tag === 'biz')).toBe(true);
        expect(privateNodes.some((node) => node.tag === 'bot')).toBe(true);

        const groupNodes = buildInteractiveAdditionalNodes('120363000000000000@g.us');
        expect(groupNodes.some((node) => node.tag === 'biz')).toBe(true);
        expect(groupNodes.some((node) => node.tag === 'bot')).toBe(false);
    });

    test('buildNativeFlowButton supports quick reply and cta_url', () => {
        const quickReply = buildNativeFlowButton({ id: 'vendas', text: 'Falar com vendedor' });
        expect(quickReply.name).toBe('quick_reply');
        expect(JSON.parse(quickReply.buttonParamsJson)).toEqual({
            display_text: 'Falar com vendedor',
            id: 'vendas',
        });

        const cta = buildNativeFlowButton({
            id: 'site',
            text: 'Visitar site',
            url: 'https://meusite.com.br',
        });
        expect(cta.name).toBe('cta_url');
    });

    test('buildNativeFlowButtons rejects duplicate quick reply ids', () => {
        expect(() =>
            buildNativeFlowButtons([
                { id: 'a', text: 'A' },
                { id: 'a', text: 'B' },
            ]),
        ).toThrow('Duplicate quick reply button id: a');
    });

    test('buildInteractiveAdditionalNodes includes native_flow metadata', () => {
        const nodes = buildInteractiveAdditionalNodes('5511999999999@s.whatsapp.net');
        const bizNode = nodes.find((node) => node.tag === 'biz');
        const interactiveNode = bizNode?.content?.find((node) => node.tag === 'interactive');

        expect(interactiveNode?.attrs?.type).toBe('native_flow');
        expect(interactiveNode?.content?.[0]?.attrs?.name).toBe('mixed');
        expect(interactiveNode?.content?.[0]?.attrs?.v).toBe('9');
    });
});
