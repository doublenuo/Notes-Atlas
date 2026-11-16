import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import type { AuthDb, User } from './db.js';
import type { EmailService } from './email.js';
import { AppError, ValidationError } from './errors.js';
import type { GithubClient } from './github.js';
import { isAdminEmail, validateNick } from './nick.js';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  createOAuthState,
  sanitizeRedirect,
  verifyOAuthState,
} from './oauth-state.js';
import { SessionService } from './session.js';

interface AuthDeps {
  db: AuthDb;
  config: AppConfig;
  sessions: SessionService;
  emailService: EmailService;
  github: GithubClient;
  now?: () => number;
}

interface PublicUser {
  id: number;
  nick: string;
  email: string;
  emailVerified: true;
  avatarUrl: string | null;
  isAdmin: boolean;
}

const emailSchema = z.object({
  email: z.string().min(3).max(254),
});

const verifySchema = z.object({
  email: z.string().min(3).max(254),
  code: z.string().min(6).max(6),
});

const nickSchema = z.object({
  nick: z.string().min(1).max(80),
});

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function readJson(c: Context): Promise<unknown> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError(415, 'unsupported_media_type', '请求必须使用 application/json');
  }
  try {
    return await c.req.json();
  } catch {
    throw new ValidationError('请求格式错误');
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? '参数不合法');
  }
  return result.data;
}

function publicUser(user: User, config: AppConfig): PublicUser {
  return {
    id: user.id,
    nick: user.nick,
    email: user.email,
    emailVerified: true,
    avatarUrl: user.avatarUrl,
    isAdmin: isAdminEmail(user.email, config.adminEmails),
  };
}

function errorResponse(c: Context, error: unknown): Response {
  if (error instanceof AppError) {
    if (error.retryAfter) c.header('Retry-After', String(error.retryAfter));
    return c.json(
      {
        error: error.code,
        message: error.message,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      },
      error.status as 400,
    );
  }
  console.error('[auth] 未处理错误', error instanceof Error ? error.message : error);
  return c.json({ error: 'internal_error', message: '服务器暂时不可用' }, 500);
}

export function createAuthRouter(deps: AuthDeps): Hono {
  const { db, config, sessions, emailService, github } = deps;
  const now = deps.now ?? nowSeconds;
  const app = new Hono();

  app.use(
    '*',
    bodyLimit({
      maxSize: 32 * 1024,
      onError: (c) => c.json({ error: 'payload_too_large', message: '请求体过大' }, 413),
    }),
  );

  app.use('*', async (c, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const origin = c.req.header('origin');
      if (origin && !config.allowedOrigins.includes(origin)) {
        return c.json({ error: 'forbidden_origin', message: '请求来源不被允许' }, 403);
      }
      if (c.req.header('sec-fetch-site') === 'cross-site') {
        return c.json({ error: 'forbidden_origin', message: '请求来源不被允许' }, 403);
      }
    }
    await next();
  });

  app.get('/me', (c) => {
    const user = sessions.currentUser(c);
    if (!user) return c.json({ error: 'unauthorized', message: '请先登录' }, 401);
    return c.json({ user: publicUser(user, config) });
  });

  app.post('/email/send', async (c) => {
    try {
      const body = parse(emailSchema, await readJson(c));
      const ip =
        c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
        c.req.header('x-real-ip') ||
        'unknown';
      const result = await emailService.sendVerificationCode(body.email, ip);
      return c.json({ ok: true, retryAfter: result.retryAfter });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  app.post('/email/verify', async (c) => {
    try {
      const body = parse(verifySchema, await readJson(c));
      const user = emailService.verifyCode(body.email, body.code);
      const session = sessions.issue(user.id);
      sessions.setCookie(c, session.token);
      return c.json({ user: publicUser(user, config) });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  app.patch('/profile', async (c) => {
    try {
      const current = sessions.currentUser(c);
      if (!current) return c.json({ error: 'unauthorized', message: '请先登录' }, 401);
      const body = parse(nickSchema, await readJson(c));
      const nick = validateNick(body.nick);
      if (!nick.ok) throw new ValidationError(nick.reason);
      const user = db.updateNick(current.id, nick.value, now());
      return c.json({ user: publicUser(user, config) });
    } catch (error) {
      return errorResponse(c, error);
    }
  });

  app.post('/logout', (c) => {
    const token = sessions.readToken(c);
    sessions.destroy(token);
    sessions.clearCookie(c);
    return c.body(null, 204);
  });

  app.get('/github', (c) => {
    if (!github.configured) {
      return c.json({ error: 'github_not_configured', message: 'GitHub 登录暂不可用' }, 503);
    }
    const redirect = sanitizeRedirect(c.req.query('redirect'), config.publicOrigin);
    const state = createOAuthState(config.sessionSecret, redirect, now());
    setCookie(c, OAUTH_STATE_COOKIE, state, {
      path: '/api/auth/github',
      domain: config.cookieDomain,
      secure: config.cookieSecure,
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: OAUTH_STATE_TTL_SECONDS,
    });
    return c.redirect(github.authorizeUrl(state), 302);
  });

  app.get('/github/callback', async (c) => {
    const stateCookie = getCookie(c, OAUTH_STATE_COOKIE);
    deleteCookie(c, OAUTH_STATE_COOKIE, {
      path: '/api/auth/github',
      domain: config.cookieDomain,
      secure: config.cookieSecure,
    });

    const state = verifyOAuthState(config.sessionSecret, stateCookie, now());
    const redirectPath = sanitizeRedirect(state?.redirect ?? '/', config.publicOrigin);
    const target = (params: Record<string, string>): string => {
      const url = new URL(redirectPath, config.publicOrigin);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      return url.toString();
    };

    if (c.req.query('error')) {
      return c.redirect(target({ auth: 'error', reason: 'access_denied' }), 302);
    }
    const code = c.req.query('code');
    const returnedState = c.req.query('state');
    if (!state || !code || !returnedState) {
      return c.redirect(target({ auth: 'error', reason: 'invalid_state' }), 302);
    }
    if (returnedState !== stateCookie) {
      return c.redirect(target({ auth: 'error', reason: 'invalid_state' }), 302);
    }

    try {
      const token = await github.exchangeCode(code);
      const profile = await github.fetchProfile(token);
      const email = await github.fetchVerifiedEmail(token);
      const user = github.upsertUser(profile, email, db, now());
      const session = sessions.issue(user.id);
      sessions.setCookie(c, session.token);
      return c.redirect(target({ auth: 'success' }), 302);
    } catch (error) {
      const reason =
        error instanceof AppError && error.code === 'github_email_unverified'
          ? 'email_unverified'
          : error instanceof AppError && error.code === 'github_email_conflict'
            ? 'email_conflict'
            : 'github_failed';
      console.error('[auth] GitHub 登录失败', error instanceof Error ? error.message : error);
      return c.redirect(target({ auth: 'error', reason }), 302);
    }
  });

  return app;
}
