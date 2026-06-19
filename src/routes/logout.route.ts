import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { whatsappManager } from '../modules/connection-manager.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/logout', async (c) => {
    const tenantId = getTenantId(c);
    const info = await whatsappManager.logout(tenantId);
    return jsonSuccess(c, info);
});

export default app;
