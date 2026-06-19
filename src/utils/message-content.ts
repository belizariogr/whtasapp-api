import { normalizeMessageContent, type WAMessage } from '@whiskeysockets/baileys';

export type ParsedReceivedMessage = {
    messageType: string;
    content: string | null;
    buttonId?: string;
};

function safeJsonParse(value: string): Record<string, unknown> | null {
    try {
        const parsed: unknown = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

export function parseReceivedMessage(msg: WAMessage): ParsedReceivedMessage | null {
    const normalized = normalizeMessageContent(msg.message ?? undefined);
    if (!normalized) {
        return null;
    }

    const messageType = Object.keys(normalized)[0] ?? 'unknown';

    const interactiveResponse = normalized.interactiveResponseMessage;
    const nativeFlowResponse = interactiveResponse?.nativeFlowResponseMessage;
    if (nativeFlowResponse) {
        const params = nativeFlowResponse.paramsJson
            ? safeJsonParse(nativeFlowResponse.paramsJson)
            : null;
        const buttonId = typeof params?.id === 'string' ? params.id : undefined;
        const content =
            buttonId ??
            interactiveResponse.body?.text ??
            (typeof params?.display_text === 'string' ? params.display_text : null);

        return { messageType, content, buttonId };
    }

    const buttonsResponse = normalized.buttonsResponseMessage;
    if (buttonsResponse?.selectedButtonId) {
        return {
            messageType,
            content: buttonsResponse.selectedButtonId,
            buttonId: buttonsResponse.selectedButtonId,
        };
    }

    const content =
        normalized.conversation ??
        normalized.extendedTextMessage?.text ??
        normalized.imageMessage?.caption ??
        null;

    return { messageType, content };
}
