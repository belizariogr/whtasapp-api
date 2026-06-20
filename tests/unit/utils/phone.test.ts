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

    test('toWhatsAppJid strips ninth digit from Brazilian mobile numbers', () => {
        expect(toWhatsAppJid('5511999887766')).toBe('551199887766@s.whatsapp.net');
        expect(toWhatsAppJid('+55 (11) 99988-7766')).toBe('551199887766@s.whatsapp.net');
    });

    test('toWhatsAppJid keeps Brazilian landline and already-normalized numbers', () => {
        expect(toWhatsAppJid('551133334444')).toBe('551133334444@s.whatsapp.net');
        expect(toWhatsAppJid('551199887766')).toBe('551199887766@s.whatsapp.net');
    });

    test('toWhatsAppJid does not change non-Brazilian numbers', () => {
        expect(toWhatsAppJid('14155552671')).toBe('14155552671@s.whatsapp.net');
    });
});
