import { env } from "../../src/config/env.ts";
import type { ConnectionInfo, LoginStatus } from "../../src/modules/types.ts";

const apiHost = process.env.API_HOST ?? "127.0.0.1";

export const actionApiBaseUrl = `http://${apiHost}:${env.port}`;
export const ACTION_FETCH_TIMEOUT_MS = 2_000;

export interface ActionGate {
    ready: boolean;
    reason: string;
    info: Pick<ConnectionInfo, "status" | "connectionStatus"> | null;
}

export const hasActionConfig =
    env.testTenantId > 0 && env.testJwtToken.length > 0;
export const hasRecipient = env.testRecipientPhone.length > 0;

export const actionGate: ActionGate = {
    ready: false,
    reason: "status ainda não verificado",
    info: null,
};

export function actionFetch(
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    return fetch(`${actionApiBaseUrl}${path}`, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(ACTION_FETCH_TIMEOUT_MS),
    });
}

export async function fetchConnectionInfo(
    token: string = env.testJwtToken,
): Promise<Pick<ConnectionInfo, "status" | "connectionStatus"> | null> {
    try {
        const res = await actionFetch("/status", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return null;

        const body = await res.json();
        if (!body.success || !body.data?.status) return null;

        return {
            status: body.data.status as LoginStatus,
            connectionStatus: body.data.connectionStatus ?? "disconnected",
        };
    } catch {
        return null;
    }
}

export function isReadyForActionTests(
    info: Pick<ConnectionInfo, "status" | "connectionStatus">,
): boolean {
    return info.status === "logged_in" && info.connectionStatus === "connected";
}

export async function prepareActionGate(
    hasActionConfig: boolean,
): Promise<ActionGate> {
    if (!hasActionConfig) {
        return {
            ready: false,
            reason: "defina TEST_TENANT_ID e TEST_JWT_TOKEN no .env",
            info: null,
        };
    }

    const info = await fetchConnectionInfo();
    if (!info) {
        return {
            ready: false,
            reason: "API indisponível ou timeout de 2s em GET /status",
            info: null,
        };
    }

    if (!isReadyForActionTests(info)) {
        return {
            ready: false,
            reason: `WhatsApp não pronto (status="${info.status}", connection="${info.connectionStatus}"). Faça login via POST /login`,
            info,
        };
    }

    return { ready: true, reason: "", info };
}

export function skipActionTest(gate: ActionGate = actionGate): boolean {
    if (gate.ready) return false;
    console.warn(`Teste ignorado: ${gate.reason}`);
    return true;
}

let gatePromise: Promise<ActionGate> | null = null;

export async function ensureActionGate(): Promise<ActionGate> {
    if (!gatePromise) {
        gatePromise = prepareActionGate(hasActionConfig).then((gate) => {
            actionGate.ready = gate.ready;
            actionGate.reason = gate.reason;
            actionGate.info = gate.info;

            if (gate.ready) {
                console.log("WhatsApp pronto — executando testes de ação");
            } else {
                console.warn(`Testes de ação ignorados: ${gate.reason}`);
            }

            return gate;
        });
    }

    return gatePromise;
}

export function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${env.testJwtToken}` };
}

export function jsonAuthHeaders(): Record<string, string> {
    return {
        Authorization: `Bearer ${env.testJwtToken}`,
        "Content-Type": "application/json",
    };
}
