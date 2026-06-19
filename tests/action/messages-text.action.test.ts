import { beforeAll, describe, expect, test } from "bun:test";
import { env } from "../../src/config/env.ts";
import {
    actionFetch,
    ensureActionGate,
    hasActionConfig,
    hasRecipient,
    jsonAuthHeaders,
    skipActionTest,
} from "../helpers/action.ts";

describe("action/messages/text", () => {
    beforeAll(() => ensureActionGate());

    test.skipIf(!hasActionConfig || !hasRecipient)(
        "POST /messages/text — envio real",
        async () => {
            if (skipActionTest()) return;

            const res = await actionFetch("/messages/text", {
                method: "POST",
                headers: jsonAuthHeaders(),
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: `[Teste API] Mensagem de teste ${new Date().toISOString()}`,
                }),
            });

            const body = await res.json();

            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.success).toBe(true);
        },
    );
});
