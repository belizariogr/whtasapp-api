import { isNonEmptyString } from './strings.ts';

const DIGITS_ONLY = /\D/g;

export function normalizePhoneNumber(phone: string): string {
    return phone.replace(DIGITS_ONLY, '');
}

/** Brazilian mobile: 55 + DDD (2) + 9 + 8 digits. WhatsApp expects the legacy 12-digit form. */
function stripBrazilNinthDigit(digits: string): string {
    if (digits.startsWith('55') && digits.length === 13 && digits.charAt(4) === '9') {
        return `${digits.slice(0, 4)}${digits.slice(5)}`;
    }
    return digits;
}

export function toWhatsAppJid(phone: string): string {
    const digits = stripBrazilNinthDigit(normalizePhoneNumber(phone));
    if (!digits) {
        throw new Error('Invalid phone number');
    }
    return `${digits}@s.whatsapp.net`;
}

export function isValidPhoneNumber(phone: unknown): phone is string {
    if (!isNonEmptyString(phone)) return false;
    const digits = normalizePhoneNumber(phone);
    return digits.length >= 10 && digits.length <= 15;
}

export function toWhatsAppJids(phones: string[]): string[] {
    return phones.map(toWhatsAppJid);
}
