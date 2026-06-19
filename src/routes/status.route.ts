import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { whatsappManager } from '../modules/whatsapp/connection-manager.ts';
import { isTruthyQueryParam } from '../utils/strings.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.get('/status', async (c) => {
    const tenantId = getTenantId(c);
    const verify = isTruthyQueryParam(c.req.query('all'));
    const info = verify
        ? await whatsappManager.verifyConnectionStatus(tenantId)
        : await whatsappManager.getConnectionInfo(tenantId);

    if (info.status === 'logged_out') {
        info.connectionStatus = 'disconnected';
    }
    return jsonSuccess(c, info);
});

export default app;
