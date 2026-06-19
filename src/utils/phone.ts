import { isNonEmptyString } from './strings.ts';

const DIGITS_ONLY = /\D/g;

export function normalizePhoneNumber(phone: string): string {
    return phone.replace(DIGITS_ONLY, '');
}

export function toWhatsAppJid(phone: string): string {
    const digits = normalizePhoneNumber(phone);
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
