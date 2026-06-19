import { describe, expect, test } from 'bun:test';
import Token from '../../../src/core/services/token.ts';
import { createTestToken } from '../../helpers/jwt';

describe('core/services/token', () => {
    test('verify valid token', () => {
        const token = createTestToken({ id: 42 });
        const payload = Token.verify(token);
        expect(payload).toBeTruthy();
        expect(payload && payload.id).toBe(42);
    });

    test('verify invalid token returns false', () => {
        expect(Token.verify('invalid.token.here')).toBe(false);
        expect(Token.verify('')).toBe(false);
    });

    test('decode token', () => {
        const token = createTestToken({ id: 7 });
        const decoded = Token.decode(token);
        expect(decoded).toBeTruthy();
        expect(decoded && decoded.id).toBe(7);
    });
});
