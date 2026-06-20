import './utils/libsignal-logs.ts';
import { env } from './config/env.ts';
import { closeDb, verifyDbConnection } from './db/client.ts';
import { runMigrations } from './db/migrations/runner.ts';

try {
    await verifyDbConnection();
    await runMigrations();
    console.log('Migrations applied successfully.');
} catch (error) {
    console.error('Database connection failed:', error);
    await closeDb();
    process.exit(1);
}

const { createApp } = await import('./app.ts');
const app = createApp();

try {
    Bun.serve({
        port: env.port,
        fetch: app.fetch,
    });
} catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code === 'EADDRINUSE') {
        console.error(
            `Port ${env.port} is already in use. Stop the other process (e.g. a previous "bun run dev") or set PORT to another value.`,
        );
    } else {
        console.error('Failed to start HTTP server:', error);
    }
    await closeDb();
    process.exit(1);
}

console.log(`WhatsApp API running on port ${env.port}...`);
