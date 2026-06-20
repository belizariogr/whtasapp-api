import { SQL } from 'bun';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../../config/env.ts';

const MIGRATIONS_DIR = import.meta.dir;

/** Conexão dedicada (max: 1) — evita hang do Bun SQL com pool > 1 em queries sequenciais. */
let migrationDb: SQL | null = null;

function getMigrationDb(): SQL {
    if (!migrationDb) {
        migrationDb = new SQL({
            adapter: 'mysql',
            hostname: env.databaseHost,
            port: env.databasePort,
            username: env.databaseUsername,
            password: env.databasePassword,
            database: env.databaseName,
            max: 1,
            connectionTimeout: 5,
        });
    }
    return migrationDb;
}

async function closeMigrationDb(): Promise<void> {
    if (migrationDb) {
        await migrationDb.close();
        migrationDb = null;
    }
}

async function ensureMigrationsTable(): Promise<void> {
    const db = getMigrationDb();
    await db`
        CREATE TABLE IF NOT EXISTS migrations (
            id VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
    const db = getMigrationDb();
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
    const db = getMigrationDb();
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
    try {
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
    } finally {
        await closeMigrationDb();
    }
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
        .finally(() => closeMigrationDb());
}
