import {
    generateMessageIDV2,
    generateWAMessageFromContent,
    isJidGroup,
    proto,
    type BinaryNode,
    type WASocket,
    type WAMessage,
} from '@whiskeysockets/baileys';

export type NativeFlowButton = {
    name: string;
    buttonParamsJson: string;
};

export type InteractiveNativeFlowInput = {
    text: string;
    footer?: string;
    buttons: NativeFlowButton[];
};

const INTERACTIVE_NATIVE_FLOW_NODES: BinaryNode[] = [
    {
        tag: 'biz',
        attrs: {},
        content: [
            {
                tag: 'interactive',
                attrs: { type: 'native_flow', v: '1' },
                content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
            },
        ],
    },
];

export function buildCtaUrlButton(displayText: string, url: string): NativeFlowButton {
    return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
            display_text: displayText,
            url,
            merchant_url: url,
        }),
    };
}

export function buildInteractiveMessageContent(
    input: InteractiveNativeFlowInput,
): proto.IMessage {
    const interactiveMessage: proto.Message.IInteractiveMessage = {
        body: { text: input.text.length > 0 ? input.text : ' ' },
        nativeFlowMessage: {
            buttons: input.buttons,
            messageVersion: 1,
        },
    };

    if (input.footer && input.footer.length > 0) {
        interactiveMessage.footer = { text: input.footer };
    }

    return { interactiveMessage };
}

export function isPrivateChat(jid: string): boolean {
    return !isJidGroup(jid);
}

export function buildInteractiveAdditionalNodes(jid: string): BinaryNode[] {
    const nodes: BinaryNode[] = [...INTERACTIVE_NATIVE_FLOW_NODES];

    if (isPrivateChat(jid)) {
        nodes.push({
            tag: 'bot',
            attrs: { biz_bot: '1' },
        });
    }

    return nodes;
}

export async function sendInteractiveNativeFlowMessage(
    socket: WASocket,
    jid: string,
    input: InteractiveNativeFlowInput,
): Promise<WAMessage> {
    const userJid = socket.user?.id;
    if (!userJid) {
        throw new Error('WhatsApp socket user is not available');
    }

    if (typeof socket.relayMessage !== 'function') {
        throw new Error('WhatsApp socket does not support relayMessage');
    }

    const messageContent = buildInteractiveMessageContent(input);
    const messageId = generateMessageIDV2(userJid);
    const fullMsg = generateWAMessageFromContent(jid, messageContent, {
        userJid,
        messageId,
        timestamp: new Date(),
    });

    await socket.relayMessage(jid, fullMsg.message!, {
        messageId: fullMsg.key.id!,
        additionalNodes: buildInteractiveAdditionalNodes(jid),
    });

    return fullMsg;
}
