import { getDb } from '../db/client.ts';

export interface TenantRecord {
    id: number;
    name: string | null;
}

export async function createTenant(name?: string | null): Promise<TenantRecord> {
    const db = getDb();
    await db`
        INSERT INTO tenants (name)
        VALUES (${name ?? null})
    `;
    const rows = await db`SELECT LAST_INSERT_ID() AS id`;
    const id = Number(rows[0]?.id);
    if (!id) {
        throw new Error('Failed to create tenant');
    }
    return { id, name: name ?? null };
}

export async function getTenant(tenantId: number): Promise<TenantRecord | null> {
    const db = getDb();
    const rows = await db`
        SELECT id, name
        FROM tenants
        WHERE id = ${tenantId}
    `;
    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
        id: Number(row.id),
        name: row.name as string | null,
    };
}

export async function deleteTenant(tenantId: number): Promise<boolean> {
    const db = getDb();
    const existing = await getTenant(tenantId);
    if (!existing) return false;
    await db`DELETE FROM tenants WHERE id = ${tenantId}`;
    return true;
}
