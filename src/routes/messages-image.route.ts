import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { sendImageMessage } from '../modules/message-sender.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/messages/image', async (c) => {
    const body = await c.req.json<{
        to?: string;
        imageUrl?: string;
        imageBase64?: string;
        caption?: string;
    }>();
    if (!isValidPhoneNumber(body.to) || (!body.imageUrl && !body.imageBase64)) {
        return c.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid to or image source' } },
            400,
        );
    }
    const result = await sendImageMessage(getTenantId(c), {
        to: body.to!,
        imageUrl: body.imageUrl,
        imageBase64: body.imageBase64,
        caption: body.caption,
    });
    return jsonSuccess(c, result);
});

export default app;
