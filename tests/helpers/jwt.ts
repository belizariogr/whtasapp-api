import JWT from 'jsonwebtoken';
import { env } from '../../src/config/env.ts';
import type { TokenPayload } from '../../src/core/services/token.ts';

export function createTestToken(payload: Partial<TokenPayload> = {}): string {
    const data: TokenPayload = {
        id: (payload.id ?? env.testTenantId) || 1,
        u: payload.u,
        tag: payload.tag,
    };
    return JWT.sign(data, env.jwtSecretKey, { expiresIn: '1h' });
}

export function createInvalidToken(): string {
    return 'invalid.jwt.token';
}
