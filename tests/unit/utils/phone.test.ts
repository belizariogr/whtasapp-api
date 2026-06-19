import { describe, expect, test } from 'bun:test';
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
    toWhatsAppJid,
    toWhatsAppJids,
} from '../../../src/utils/phone.ts';

describe('utils/phone', () => {
    test('normalizePhoneNumber removes non-digits', () => {
        expect(normalizePhoneNumber('+55 (11) 99999-9999')).toBe('5511999999999');
    });

    test('toWhatsAppJid', () => {
        expect(toWhatsAppJid('5511999999999')).toBe('5511999999999@s.whatsapp.net');
    });

    test('isValidPhoneNumber', () => {
        expect(isValidPhoneNumber('5511999999999')).toBe(true);
        expect(isValidPhoneNumber('123')).toBe(false);
        expect(isValidPhoneNumber('')).toBe(false);
    });

    test('toWhatsAppJids', () => {
        expect(toWhatsAppJids(['5511111111111', '5522222222222'])).toEqual([
            '5511111111111@s.whatsapp.net',
            '5522222222222@s.whatsapp.net',
        ]);
    });

    test('toWhatsAppJid throws on invalid phone', () => {
        expect(() => toWhatsAppJid('')).toThrow('Invalid phone number');
    });
});
