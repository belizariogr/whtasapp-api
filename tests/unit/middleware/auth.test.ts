import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from '../../../src/middleware/auth.ts';
import { createTestToken } from '../../helpers/jwt.ts';

describe('middleware/auth', () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/protected', (c) => c.json({ tenantId: c.get('tenantId') }));

    test('allows valid bearer token', async () => {
        const token = createTestToken({ id: 123 });
        const res = await app.request('/protected', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tenantId).toBe(123);
    });

    test('rejects missing authorization', async () => {
        const res = await app.request('/protected');
        expect(res.status).toBe(401);
    });
});
