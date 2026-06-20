import { env } from '../../src/config/env.ts';
import { toWhatsAppJid } from '../../src/utils/phone.ts';

export const testPhone = env.testRecipientPhone;

export const testJid = toWhatsAppJid(testPhone);

export const testLid = `${testPhone}@lid`;

/** Formats testPhone as +55 (XX) XXXXX-XXXX for normalizePhoneNumber tests. */
export function formatTestPhone(phone: string = testPhone): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
        const area = digits.slice(2, 4);
        const rest = digits.slice(4);
        return `+55 (${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    return phone;
}
