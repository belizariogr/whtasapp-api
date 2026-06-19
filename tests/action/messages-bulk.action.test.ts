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

describe("action/messages/bulk", () => {
    beforeAll(() => ensureActionGate());

    test.skipIf(!hasActionConfig || !hasRecipient)(
        "POST /messages/bulk — envio em massa",
        async () => {
            if (skipActionTest()) return;

            const res = await actionFetch("/messages/bulk", {
                method: "POST",
                headers: jsonAuthHeaders(),
                body: JSON.stringify({
                    recipients: [env.testRecipientPhone],
                    message: {
                        type: "text",
                        text: `[Bulk Test] ${new Date().toISOString()}`,
                    },
                }),
            });

            const body = await res.json();
            expect(res.status).toBe(200);
            expect(body.data.results).toHaveLength(1);
        },
    );
});
