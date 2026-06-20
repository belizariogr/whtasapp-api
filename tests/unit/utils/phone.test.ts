import { describe, expect, test } from 'bun:test';
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
    toWhatsAppJid,
    toWhatsAppJids,
} from '../../../src/utils/phone.ts';
import { formatTestPhone, testJid, testPhone } from '../../helpers/phone.ts';

describe('utils/phone', () => {
    test('normalizePhoneNumber removes non-digits', () => {
        expect(normalizePhoneNumber(formatTestPhone())).toBe(testPhone);
    });

    test('toWhatsAppJid', () => {
        expect(toWhatsAppJid(testPhone)).toBe(testJid);
    });

    test('isValidPhoneNumber', () => {
        expect(isValidPhoneNumber(testPhone)).toBe(true);
        expect(isValidPhoneNumber('123')).toBe(false);
        expect(isValidPhoneNumber('')).toBe(false);
    });

    test('toWhatsAppJids', () => {
        expect(toWhatsAppJids([testPhone, testPhone])).toEqual([testJid, testJid]);
    });

    test('toWhatsAppJid throws on invalid phone', () => {
        expect(() => toWhatsAppJid('')).toThrow('Invalid phone number');
    });
});
