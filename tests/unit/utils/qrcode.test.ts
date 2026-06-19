import { describe, expect, test } from 'bun:test';
import { qrStringToPngBase64, qrStringToPngBuffer } from '../../../src/utils/qrcode';

describe('utils/qrcode', () => {
    test('qrStringToPngBuffer returns a PNG buffer', async () => {
        const buffer = await qrStringToPngBuffer('2@test-qr-string');
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    });

    test('qrStringToPngBase64 returns a PNG base64 string', async () => {
        const base64 = await qrStringToPngBase64('2@test-qr-string');
        const buffer = Buffer.from(base64, 'base64');
        expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    });
});
