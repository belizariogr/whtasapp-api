import { describe, expect, test } from 'bun:test';
import { resolveLoginStatus } from '../../../src/modules/login-status.ts';

describe('modules/whatsapp/login-status', () => {
    test('logged_in requires credentials', () => {
        expect(resolveLoginStatus(true, false)).toBe('logged_in');
        expect(resolveLoginStatus(false, false)).toBe('logged_out');
    });

    test('active QR login stays qr_pending without credentials', () => {
        expect(resolveLoginStatus(false, true)).toBe('qr_pending');
    });
});
