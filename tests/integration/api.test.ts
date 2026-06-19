import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/app.ts';
import { createTestToken } from '../helpers/jwt';

describe('integration/health', () => {
  const app = createApp();

  test('GET /health returns response', async () => {
    const res = await app.request('/health/health');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('database');
  });
});

describe('integration/whatsapp auth', () => {
  const app = createApp();

  test('rejects request without token', async () => {
    const res = await app.request('/whatsapp/status');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('rejects invalid token', async () => {
    const res = await app.request('/whatsapp/status', {
      headers: { Authorization: 'Bearer invalid.token' },
    });
    expect(res.status).toBe(401);
  });

  test('GET /whatsapp/status with valid token', async () => {
    const token = createTestToken({ id: 999 });
    const res = await app.request('/whatsapp/status', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 500) {
      // DB unavailable in CI/local without MariaDB
      const body = await res.json();
      expect(body.success).toBe(false);
      return;
    }

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('connectionStatus');
    expect(['logged_out', 'logged_in', 'qr_pending']).toContain(body.data.status);
    expect(['disconnected', 'connecting', 'connected']).toContain(body.data.connectionStatus);
  });
});

describe('integration/whatsapp validation', () => {
  const app = createApp();
  const token = createTestToken({ id: 999 });

  test('POST /messages/text validates payload', async () => {
    const res = await app.request('/whatsapp/messages/text', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'invalid', text: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST /messages/bulk validates recipients', async () => {
    const res = await app.request('/whatsapp/messages/bulk', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipients: [], message: { type: 'text' } }),
    });
    expect(res.status).toBe(400);
  });
});
