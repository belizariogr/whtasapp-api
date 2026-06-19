import { beforeAll, describe, expect, test } from "bun:test";
import {
    actionFetch,
    authHeaders,
    ensureActionGate,
    hasActionConfig,
    skipActionTest,
} from "../helpers/action.ts";

describe("action/status", () => {
    beforeAll(() => ensureActionGate());

    test.skipIf(!hasActionConfig)(
        "GET /status — tenant conectado",
        async () => {
            if (skipActionTest()) return;

            const res = await actionFetch("/status", {
                headers: authHeaders(),
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.data.status).toBe("logged_in");
            expect(body.data.connectionStatus).toBe("connected");
            console.log("Connection status:", body.data);
        },
    );
});
