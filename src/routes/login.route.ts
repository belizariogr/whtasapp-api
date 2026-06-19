import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { qrStringToPngBase64, qrStringToPngBuffer } from '../utils/qrcode.ts';
import { whatsappManager } from '../modules/connection-manager.ts';
import { isWhatsAppApiError } from '../modules/types.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/login', async (c) => {
    const tenantId = getTenantId(c);
    const type = (c.req.query('type') ?? 'img').toLowerCase();

    if (type !== 'img' && type !== 'json') {
        return jsonError(c, 'VALIDATION_ERROR', 'Invalid type. Use img or json.', 400);
    }

    try {
        const { qrCode } = await whatsappManager.login(tenantId);

        if (type === 'json') {
            return jsonSuccess(c, { qrCode: await qrStringToPngBase64(qrCode) });
        }

        const png = await qrStringToPngBuffer(qrCode);
        return new Response(png, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        if (isWhatsAppApiError(error)) {
            throw error;
        }
        const message = error instanceof Error ? error.message : 'Failed to start WhatsApp login';
        return jsonError(c, 'LOGIN_ERROR', message, 503);
    }
});

export default app;
