import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { sendBulkMessage } from '../modules/message-sender.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { isNonEmptyString } from '../utils/strings.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/messages/bulk', async (c) => {
    const body = await c.req.json<{
        recipients?: string[];
        message?: {
            type?: string;
            text?: string;
            imageUrl?: string;
            imageBase64?: string;
            caption?: string;
            footer?: string;
            buttons?: Array<{ id?: string; text?: string }>;
            buttonText?: string;
            url?: string;
        };
    }>();

    if (!body.recipients?.length || !body.message?.type) {
        return c.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'recipients and message.type are required' } },
            400,
        );
    }

    const invalid = body.recipients.some((r) => !isValidPhoneNumber(r));
    if (invalid) {
        return c.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'One or more invalid phone numbers' } },
            400,
        );
    }

    const results = await sendBulkMessage(getTenantId(c), {
        recipients: body.recipients,
        message: {
            type: body.message.type as 'text' | 'link' | 'image' | 'buttons' | 'link_button',
            text: body.message.text,
            imageUrl: body.message.imageUrl,
            imageBase64: body.message.imageBase64,
            caption: body.message.caption,
            footer: body.message.footer,
            buttons: body.message.buttons
                ?.filter((b) => isNonEmptyString(b.text))
                .map((b) => ({ id: b.id ?? b.text!, text: b.text! })),
            buttonText: body.message.buttonText,
            url: body.message.url,
        },
    });

    return jsonSuccess(c, { results });
});

export default app;
