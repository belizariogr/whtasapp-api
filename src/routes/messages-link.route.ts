import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { sendLinkMessage } from '../modules/message-sender.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { isNonEmptyString } from '../utils/strings.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/messages/link', async (c) => {
    const body = await c.req.json<{ to?: string; text?: string }>();
    if (!isValidPhoneNumber(body.to) || !isNonEmptyString(body.text)) {
        return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid to or text' } }, 400);
    }
    const result = await sendLinkMessage(getTenantId(c), { to: body.to, text: body.text });
    return jsonSuccess(c, result);
});

export default app;
