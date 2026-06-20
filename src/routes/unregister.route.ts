import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { getTenantId } from '../core/services/helpers.ts';
import { whatsappManager } from '../modules/connection-manager.ts';
import { deleteTenant } from '../modules/tenant-repository.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.post('/unregister', async (c) => {
    const tenantId = getTenantId(c);

    try {
        await whatsappManager.removeTenant(tenantId);

        const deleted = await deleteTenant(tenantId);
        if (!deleted) {
            return jsonError(c, 'NOT_FOUND', 'Tenant not found', 404);
        }

        return jsonSuccess(c, { tenantId, unregistered: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to unregister tenant';
        return jsonError(c, 'UNREGISTER_ERROR', message, 500);
    }
});

export default app;
