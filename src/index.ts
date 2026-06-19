import './utils/libsignal-logs.ts';
import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { runMigrations } from './db/migrations/runner.ts';

const app = createApp();

async function bootstrap() {
    try {
        await runMigrations();
        console.log('Migrations applied successfully.');
    } catch (error) {
        console.warn('Migration warning (server will still start):', error);
    }

    Bun.serve({
        port: env.port,
        fetch: app.fetch,
    });

    console.log(`WhatsApp API running on port ${env.port}...`);
}

bootstrap();
