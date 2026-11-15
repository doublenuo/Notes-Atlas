import { Hono } from 'hono';
import type { AppConfig } from './config.js';
import type { AuthDb } from './db.js';
import type { EmailService } from './email.js';
import { AppError } from './errors.js';
import type { GithubClient } from './github.js';
import { createAuthRouter } from './auth.js';
import type { SessionService } from './session.js';
import { createTwikooProxy } from './twikoo.js';

export interface AppDeps {
  db: AuthDb;
  config: AppConfig;
  sessions: SessionService;
  emailService: EmailService;
  github: GithubClient;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get('/healthz', (c) => {
    if (!deps.db.ping()) {
      return c.json({ ok: false, error: 'database_unavailable' }, 503);
    }
    return c.json({ ok: true });
  });

  app.route('/api/auth', createAuthRouter(deps));
  app.all('/twikoo-api/*', createTwikooProxy(deps, true));
  app.all('*', createTwikooProxy(deps, false));

  app.onError((error, c) => {
    if (error instanceof AppError) {
      if (error.retryAfter) c.header('Retry-After', String(error.retryAfter));
      return c.json({ error: error.code, message: error.message }, error.status as 400);
    }
    console.error('[gateway] 未处理错误', error instanceof Error ? error.message : error);
    return c.json({ error: 'internal_error', message: '服务器暂时不可用' }, 500);
  });

  return app;
}
