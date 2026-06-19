import { describe, expect, test } from 'bun:test';
import { env } from '../../src/config/env.ts';

const BASE_URL = `http://${env.host}:${env.port}`;
const hasActionConfig = env.testTenantId > 0 && env.testJwtToken.length > 0;
const hasRecipient = env.testRecipientPhone.length > 0;

describe('action/whatsapp', () => {
    test.skipIf(!hasActionConfig)('GET /whatsapp/status — tenant conectado', async () => {
        const res = await fetch(`${BASE_URL}/status`, {
            headers: { Authorization: `Bearer ${env.testJwtToken}` },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.status).toBeDefined();
        console.log('Connection status:', body.data);
    });

    test.skipIf(!hasActionConfig || !hasRecipient)(
        'POST /whatsapp/messages/text — envio real',
        async () => {
            const res = await fetch(`${BASE_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.testJwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: `[Teste API] Mensagem de teste ${new Date().toISOString()}`,
                }),
            });

            const body = await res.json();
            if (body.error?.message?.includes('not connected')) {
                console.warn('WhatsApp não logado — faça login via POST /login');
                return;
            }

            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
        },
    );

    test.skipIf(!hasActionConfig || !hasRecipient)(
        'POST /whatsapp/messages/link — envio com link',
        async () => {
            const res = await fetch(`${BASE_URL}/messages/link`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.testJwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: 'Confira: https://github.com/WhiskeySockets/Baileys',
                }),
            });

            const body = await res.json();
            if (body.error?.message?.includes('not connected')) return;
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
        },
    );

    test.skipIf(!hasActionConfig || !hasRecipient)(
        'POST /whatsapp/messages/buttons — botões de resposta',
        async () => {
            const res = await fetch(`${BASE_URL}/messages/buttons`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.testJwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: 'Escolha uma opção:',
                    footer: 'Teste API',
                    buttons: [
                        { id: 'opt_sim', text: 'Sim' },
                        { id: 'opt_nao', text: 'Não' },
                    ],
                }),
            });

            const body = await res.json();
            if (body.error?.message?.includes('not connected')) return;
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
        },
    );

    test.skipIf(!hasActionConfig || !hasRecipient)(
        'POST /whatsapp/messages/bulk — envio em massa',
        async () => {
            const res = await fetch(`${BASE_URL}/messages/bulk`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${env.testJwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipients: [env.testRecipientPhone],
                    message: {
                        type: 'text',
                        text: `[Bulk Test] ${new Date().toISOString()}`,
                    },
                }),
            });

            const body = await res.json();
            if (body.error?.message?.includes('not connected')) return;
            expect(res.status).toBe(200);
            expect(body.data.results).toHaveLength(1);
        },
    );
});
