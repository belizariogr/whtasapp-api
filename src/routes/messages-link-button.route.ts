import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { sendLinkButtonMessage } from '../modules/message-sender.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { isNonEmptyString } from '../utils/strings.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/messages/link-button', async (c) => {
    const body = await c.req.json<{
        to?: string;
        text?: string;
        footer?: string;
        buttonText?: string;
        url?: string;
    }>();
    if (
        !isValidPhoneNumber(body.to) ||
        !isNonEmptyString(body.text) ||
        !isNonEmptyString(body.buttonText) ||
        !isNonEmptyString(body.url)
    ) {
        return c.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload for link button message' } },
            400,
        );
    }
    const result = await sendLinkButtonMessage(getTenantId(c), {
        to: body.to,
        text: body.text,
        footer: body.footer,
        buttonText: body.buttonText,
        url: body.url,
    });
    return jsonSuccess(c, result);
});

export default app;
