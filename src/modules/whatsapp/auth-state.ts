import {
    initAuthCreds,
    BufferJSON,
    proto,
    type AuthenticationCreds,
    type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { getDb } from '../../db/client.ts';

export function hasAuthenticatedCreds(creds: AuthenticationCreds): boolean {
    return Boolean(creds.me?.id || creds.registered);
}

function fixKeyName(name: string): string {
    return name.replace(/\//g, '__').replace(/:/g, '-');
}

export async function useDatabaseAuthState(tenantId: number) {
    const db = getDb();

    const readCreds = async (): Promise<AuthenticationCreds> => {
        const rows = await db`
            SELECT creds FROM whatsapp_auth_creds WHERE tenant_id = ${tenantId}
        `;
        if (rows.length === 0) return initAuthCreds();
        const raw = rows[0]!.creds;
        const json = typeof raw === 'string' ? raw : JSON.stringify(raw);
        return JSON.parse(json, BufferJSON.reviver) as AuthenticationCreds;
    };

    const writeCreds = async (creds: AuthenticationCreds): Promise<void> => {
        const serialized = JSON.stringify(creds, BufferJSON.replacer);
        await db`
            INSERT INTO whatsapp_auth_creds (tenant_id, creds)
            VALUES (${tenantId}, ${serialized})
            ON DUPLICATE KEY UPDATE creds = VALUES(creds), updated_at = CURRENT_TIMESTAMP
        `;
    };

    const readKey = async (category: string, id: string) => {
        const rows = await db`
            SELECT value FROM whatsapp_auth_keys
            WHERE tenant_id = ${tenantId} AND category = ${category} AND key_id = ${fixKeyName(id)}
        `;
        if (rows.length === 0) return null;
        const raw = rows[0]!.value;
        if (raw === null) return null;
        const json = typeof raw === 'string' ? raw : JSON.stringify(raw);
        let value = JSON.parse(json, BufferJSON.reviver);
        if (category === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        return value;
    };

    const writeKey = async (category: string, id: string, value: unknown) => {
        const keyId = fixKeyName(id);
        if (value) {
            const serialized = JSON.stringify(value, BufferJSON.replacer);
            await db`
                INSERT INTO whatsapp_auth_keys (tenant_id, category, key_id, value)
                VALUES (${tenantId}, ${category}, ${keyId}, ${serialized})
                ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP
            `;
        } else {
            await db`
                DELETE FROM whatsapp_auth_keys
                WHERE tenant_id = ${tenantId} AND category = ${category} AND key_id = ${keyId}
            `;
        }
    };

    const creds = await readCreds();

    return {
        state: {
            creds,
            keys: {
                get: async <T extends keyof SignalDataTypeMap>(
                    type: T,
                    ids: string[],
                ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
                    const data: { [id: string]: SignalDataTypeMap[T] } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            const value = await readKey(type as string, id);
                            if (value !== undefined) {
                                data[id] = value as SignalDataTypeMap[T];
                            }
                        }),
                    );
                    return data;
                },
                set: async (data: Record<string, Record<string, unknown>>) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            tasks.push(writeKey(category, id, data[category]![id]));
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: async () => writeCreds(creds),
    };
}
