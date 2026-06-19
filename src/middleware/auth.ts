import type { Context, Next } from 'hono';
import Token, { type TokenPayload } from '../core/services/token.ts';
import { jsonError } from '../utils/response.ts';

export type AuthVariables = {
    tenantId: number;
    tokenPayload: TokenPayload;
};

function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
}

export async function authMiddleware(c: Context, next: Next) {
    const token = extractBearerToken(c.req.header('Authorization'));

    if (!token) {
        return jsonError(c, 'UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
    }

    const payload = Token.verify(token);
    if (!payload) {
        return jsonError(c, 'UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    if (!payload.id) {
        return jsonError(c, 'UNAUTHORIZED', 'Token missing tenant id', 401);
    }

    c.set('tenantId', payload.id);
    c.set('tokenPayload', payload);

    await next();
}
