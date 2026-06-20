import { describe, expect, test } from 'bun:test';
import { initAuthCreds } from '@whiskeysockets/baileys';
import { hasAuthenticatedCreds } from '../../../src/modules/auth-state';
import { testJid } from '../../helpers/phone.ts';

describe('modules/whatsapp/auth-state', () => {
    test('hasAuthenticatedCreds is false for fresh creds', () => {
        expect(hasAuthenticatedCreds(initAuthCreds())).toBe(false);
    });

    test('hasAuthenticatedCreds is true when me.id exists (QR pairing)', () => {
        const creds = initAuthCreds();
        creds.me = { id: testJid, name: 'Test' };
        expect(hasAuthenticatedCreds(creds)).toBe(true);
    });

    test('hasAuthenticatedCreds is true when registered flag is set', () => {
        const creds = initAuthCreds();
        creds.registered = true;
        expect(hasAuthenticatedCreds(creds)).toBe(true);
    });
});
