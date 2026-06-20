import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import registerRoute from '../../../src/routes/register.route.ts';
import type { ApiError } from '../../../src/utils/response.ts';

describe('routes/register', () => {
    const app = new Hono();
    app.route('/', registerRoute);

    test('rejects invalid name', async () => {
        const res = await app.request('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '' }),
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as ApiError;
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects name longer than 255 characters', async () => {
        const res = await app.request('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'a'.repeat(256) }),
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as ApiError;
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});
