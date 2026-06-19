import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { sendButtonsMessage } from '../modules/message-sender.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { isNonEmptyString } from '../utils/strings.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/messages/buttons', async (c) => {
    const body = await c.req.json<{
        to?: string;
        text?: string;
        footer?: string;
        buttons?: Array<{ id?: string; text?: string; url?: string }>;
    }>();
    if (
        !isValidPhoneNumber(body.to) ||
        !isNonEmptyString(body.text) ||
        !body.buttons?.length ||
        !body.buttons.every((b) => isNonEmptyString(b.text) && (isNonEmptyString(b.url) || isNonEmptyString(b.id)))
    ) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message:
                        'Invalid payload for buttons message. Each button needs text and id (quick reply) or url (link button).',
                },
            },
            400,
        );
    }
    const buttons = body.buttons.map((b) => ({
        id: b.id ?? b.text!,
        text: b.text!,
        url: b.url,
    }));

    const result = await sendButtonsMessage(getTenantId(c), {
        to: body.to,
        text: body.text,
        footer: body.footer,
        buttons,
    });
    return jsonSuccess(c, result);
});

export default app;
