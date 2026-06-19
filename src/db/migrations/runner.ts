import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb, closeDb } from '../client.ts';

const MIGRATIONS_DIR = import.meta.dir;

async function ensureMigrationsTable(): Promise<void> {
    const db = getDb();
    await db`
        CREATE TABLE IF NOT EXISTS migrations (
            id VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
    const db = getDb();
    const rows = await db`SELECT id FROM migrations ORDER BY id`;
    return new Set(rows.map((row) => String(row.id)));
}

function stripSqlComments(sql: string): string {
    return sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
}

async function applyMigration(id: string, sql: string): Promise<void> {
    const db = getDb();
    const statements = stripSqlComments(sql)
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const statement of statements) {
        await db.unsafe(statement);
    }

    await db`INSERT INTO migrations (id) VALUES (${id})`;
}

export async function runMigrations(): Promise<string[]> {
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    const files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith('.sql'))
        .sort();

    const newlyApplied: string[] = [];

    for (const file of files) {
        const id = file.replace('.sql', '');
        if (applied.has(id)) continue;

        const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
        await applyMigration(id, content);
        newlyApplied.push(id);
        console.log(`Applied migration: ${id}`);
    }

    return newlyApplied;
}

if (import.meta.main) {
    runMigrations()
        .then((applied) => {
            if (applied.length === 0) {
                console.log('No pending migrations.');
            } else {
                console.log(`Applied ${applied.length} migration(s).`);
            }
        })
        .catch((err) => {
            console.error('Migration failed:', err);
            process.exit(1);
        })
        .finally(() => closeDb());
}
