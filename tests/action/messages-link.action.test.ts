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

describe("action/messages/link", () => {
    beforeAll(() => ensureActionGate());

    test.skipIf(!hasActionConfig || !hasRecipient)(
        "POST /messages/link — envio com link",
        async () => {
            if (skipActionTest()) return;

            const res = await actionFetch("/messages/link", {
                method: "POST",
                headers: jsonAuthHeaders(),
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: "Confira: https://github.com/WhiskeySockets/Baileys",
                }),
            });

            const body = await res.json();
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
        },
    );
});
