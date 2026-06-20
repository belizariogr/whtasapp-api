import { Hono } from 'hono';
import Token from '../core/services/token.ts';
import { createTenant } from '../modules/tenant-repository.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';

const app = new Hono();

app.post('/register', async (c) => {
    let body: { name?: unknown } = {};
    try {
        body = await c.req.json();
    } catch {
        body = {};
    }

    const name = body.name;
    if (name !== undefined && name !== null) {
        if (typeof name !== 'string' || name.trim() === '') {
            return jsonError(c, 'VALIDATION_ERROR', 'name must be a non-empty string', 400);
        }
        if (name.length > 255) {
            return jsonError(c, 'VALIDATION_ERROR', 'name must be at most 255 characters', 400);
        }
    }

    try {
        const tenant = await createTenant(typeof name === 'string' ? name.trim() : null);
        const token = Token.sign(tenant.id);

        return jsonSuccess(c, {
            tenantId: tenant.id,
            name: tenant.name,
            token,
        }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to register tenant';
        return jsonError(c, 'REGISTER_ERROR', message, 500);
    }
});

export default app;
