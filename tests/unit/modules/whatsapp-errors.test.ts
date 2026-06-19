import { describe, expect, test } from 'bun:test';
import {
    isWhatsAppApiError,
    TenantAlreadyLoggedInError,
    WhatsAppNotLoggedInError,
    WhatsAppQrPendingError,
} from '../../../src/modules/types';

describe('modules/whatsapp/errors', () => {
    test('WhatsAppNotLoggedInError is a WhatsAppApiError with 401', () => {
        const error = new WhatsAppNotLoggedInError();
        expect(isWhatsAppApiError(error)).toBe(true);
        expect(error.code).toBe('NOT_LOGGED_IN');
        expect(error.statusCode).toBe(401);
    });

    test('TenantAlreadyLoggedInError is a WhatsAppApiError with 409', () => {
        const error = new TenantAlreadyLoggedInError();
        expect(isWhatsAppApiError(error)).toBe(true);
        expect(error.code).toBe('ALREADY_LOGGED_IN');
        expect(error.statusCode).toBe(409);
    });

    test('WhatsAppQrPendingError is a WhatsAppApiError with 409', () => {
        const error = new WhatsAppQrPendingError();
        expect(isWhatsAppApiError(error)).toBe(true);
        expect(error.code).toBe('QR_PENDING');
        expect(error.statusCode).toBe(409);
    });
});
