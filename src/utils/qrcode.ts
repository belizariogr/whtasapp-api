import QRCode from 'qrcode';

export async function qrStringToPngBuffer(qr: string, width = 300): Promise<Buffer> {
    return QRCode.toBuffer(qr, { type: 'png', width, margin: 2 });
}

export async function qrStringToPngBase64(qr: string, width = 300): Promise<string> {
    const buffer = await qrStringToPngBuffer(qr, width);
    return buffer.toString('base64');
}
