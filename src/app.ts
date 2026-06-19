import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { isWhatsAppApiError } from './modules/types.ts';
import routes from './routes/index.ts';

export function createApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  app.route('/', routes);

  app.notFound((c) =>
    c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
  );

  app.onError((err, c) => {
    if (isWhatsAppApiError(err)) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        err.statusCode as 401 | 409 | 503,
      );
    }

    console.error('[API Error]', err);
    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message ?? 'Internal server error',
        },
      },
      500,
    );
  });

  return app;
}

export default createApp;
