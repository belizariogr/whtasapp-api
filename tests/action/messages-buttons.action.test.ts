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

describe("action/messages/buttons", () => {
    beforeAll(() => ensureActionGate());

    test.skipIf(!hasActionConfig || !hasRecipient)(
        "POST /messages/buttons — botões de resposta",
        async () => {
            if (skipActionTest()) return;

            const res = await actionFetch("/messages/buttons", {
                method: "POST",
                headers: jsonAuthHeaders(),
                body: JSON.stringify({
                    to: env.testRecipientPhone,
                    text: "Escolha uma opção:",
                    footer: "Teste API",
                    buttons: [
                        { id: "opt_sim", text: "Sim" },
                        { id: "opt_nao", text: "Não" },
                    ],
                }),
            });

            const body = await res.json();
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
        },
    );
});
