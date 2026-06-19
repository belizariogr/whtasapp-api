import { Hono } from 'hono';
import type { AuthVariables } from '../middleware/auth.ts';
import { jsonSuccess } from '../utils/response.ts';
import { getLastReceivedMessage } from '../modules/session-repository.ts';
import { getTenantId } from '../core/services/helpers.ts';

const app = new Hono<{ Variables: AuthVariables }>();

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
