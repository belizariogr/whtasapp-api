import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { authMiddleware } from '../middleware/auth.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { qrStringToPngBase64, qrStringToPngBuffer } from '../utils/qrcode.ts';
import { whatsappManager } from '../modules/whatsapp/connection-manager.ts';
import { isWhatsAppApiError } from '../modules/whatsapp/types.ts';
import {
  sendBulkMessage,
  sendButtonsMessage,
  sendImageMessage,
  sendLinkButtonMessage,
  sendLinkMessage,
  sendTextMessage,
} from '../modules/whatsapp/message-sender.ts';
import { getLastReceivedMessage } from '../modules/whatsapp/session-repository.ts';
import { isValidPhoneNumber } from '../utils/phone.ts';
import { isNonEmptyString, isTruthyQueryParam } from '../utils/strings.ts';

const app = new Hono<{ Variables: AuthVariables }>();

app.use('*', authMiddleware);

function getTenantId(c: { get: (key: 'tenantId') => number }): number {
  return c.get('tenantId');
}

app.post('/login', async (c) => {
  const tenantId = getTenantId(c);
  const type = (c.req.query('type') ?? 'img').toLowerCase();

  if (type !== 'img' && type !== 'json') {
    return jsonError(c, 'VALIDATION_ERROR', 'Invalid type. Use img or json.', 400);
  }

  try {
    const { qrCode } = await whatsappManager.login(tenantId);

    if (type === 'json') {
      return jsonSuccess(c, { qrCode: await qrStringToPngBase64(qrCode) });
    }

    const png = await qrStringToPngBuffer(qrCode);
    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isWhatsAppApiError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Failed to start WhatsApp login';
    return jsonError(c, 'LOGIN_ERROR', message, 503);
  }
});

app.post('/logout', async (c) => {
  const tenantId = getTenantId(c);
  const info = await whatsappManager.logout(tenantId);
  return jsonSuccess(c, info);
});

app.get('/status', async (c) => {
  const tenantId = getTenantId(c);
  const verify = isTruthyQueryParam(c.req.query('all'));
  const info = verify
    ? await whatsappManager.verifyConnectionStatus(tenantId)
    : await whatsappManager.getConnectionInfo(tenantId);

  if (info.qrCode) {
    return jsonSuccess(c, {
      ...info,
      qrCode: await qrStringToPngBase64(info.qrCode),
    });
  }

  return jsonSuccess(c, info);
});

app.post('/messages/text', async (c) => {
  const body = await c.req.json<{ to?: string; text?: string }>();
  if (!isValidPhoneNumber(body.to) || !isNonEmptyString(body.text)) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid to or text' } }, 400);
  }
  const result = await sendTextMessage(getTenantId(c), { to: body.to, text: body.text });
  return jsonSuccess(c, result);
});

app.post('/messages/link', async (c) => {
  const body = await c.req.json<{ to?: string; text?: string }>();
  if (!isValidPhoneNumber(body.to) || !isNonEmptyString(body.text)) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid to or text' } }, 400);
  }
  const result = await sendLinkMessage(getTenantId(c), { to: body.to, text: body.text });
  return jsonSuccess(c, result);
});

app.post('/messages/image', async (c) => {
  const body = await c.req.json<{
    to?: string;
    imageUrl?: string;
    imageBase64?: string;
    caption?: string;
  }>();
  if (!isValidPhoneNumber(body.to) || (!body.imageUrl && !body.imageBase64)) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid to or image source' } },
      400,
    );
  }
  const result = await sendImageMessage(getTenantId(c), {
    to: body.to!,
    imageUrl: body.imageUrl,
    imageBase64: body.imageBase64,
    caption: body.caption,
  });
  return jsonSuccess(c, result);
});

app.post('/messages/buttons', async (c) => {
  const body = await c.req.json<{
    to?: string;
    text?: string;
    footer?: string;
    buttons?: Array<{ id?: string; text?: string }>;
  }>();
  if (
    !isValidPhoneNumber(body.to) ||
    !isNonEmptyString(body.text) ||
    !body.buttons?.length
  ) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload for buttons message' } },
      400,
    );
  }
  const buttons = body.buttons
    .filter((b) => isNonEmptyString(b.text))
    .map((b) => ({ id: b.id ?? b.text!, text: b.text! }));

  const result = await sendButtonsMessage(getTenantId(c), {
    to: body.to,
    text: body.text,
    footer: body.footer,
    buttons,
  });
  return jsonSuccess(c, result);
});

app.post('/messages/link-button', async (c) => {
  const body = await c.req.json<{
    to?: string;
    text?: string;
    footer?: string;
    buttonText?: string;
    url?: string;
  }>();
  if (
    !isValidPhoneNumber(body.to) ||
    !isNonEmptyString(body.text) ||
    !isNonEmptyString(body.buttonText) ||
    !isNonEmptyString(body.url)
  ) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payload for link button message' } },
      400,
    );
  }
  const result = await sendLinkButtonMessage(getTenantId(c), {
    to: body.to,
    text: body.text,
    footer: body.footer,
    buttonText: body.buttonText,
    url: body.url,
  });
  return jsonSuccess(c, result);
});

app.post('/messages/bulk', async (c) => {
  const body = await c.req.json<{
    recipients?: string[];
    message?: {
      type?: string;
      text?: string;
      imageUrl?: string;
      imageBase64?: string;
      caption?: string;
      footer?: string;
      buttons?: Array<{ id?: string; text?: string }>;
      buttonText?: string;
      url?: string;
    };
  }>();

  if (!body.recipients?.length || !body.message?.type) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'recipients and message.type are required' } },
      400,
    );
  }

  const invalid = body.recipients.some((r) => !isValidPhoneNumber(r));
  if (invalid) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'One or more invalid phone numbers' } },
      400,
    );
  }

  const results = await sendBulkMessage(getTenantId(c), {
    recipients: body.recipients,
    message: {
      type: body.message.type as 'text' | 'link' | 'image' | 'buttons' | 'link_button',
      text: body.message.text,
      imageUrl: body.message.imageUrl,
      imageBase64: body.message.imageBase64,
      caption: body.message.caption,
      footer: body.message.footer,
      buttons: body.message.buttons
        ?.filter((b) => isNonEmptyString(b.text))
        .map((b) => ({ id: b.id ?? b.text!, text: b.text! })),
      buttonText: body.message.buttonText,
      url: body.message.url,
    },
  });

  return jsonSuccess(c, { results });
});

app.get('/messages/last-received', async (c) => {
  const tenantId = getTenantId(c);
  const row = await getLastReceivedMessage(tenantId);
  if (!row) {
    return jsonSuccess(c, null);
  }
  return jsonSuccess(c, {
    remoteJid: row.remote_jid,
    messageId: row.message_id,
    messageType: row.message_type,
    content: row.content,
    receivedAt: row.received_at,
  });
});

export default app;
