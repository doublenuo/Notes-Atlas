import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { AuthDb } from '../src/db.js';
import { EmailService, type Mailer } from '../src/email.js';
import { GithubClient } from '../src/github.js';
import { SessionService, hashToken } from '../src/session.js';

const BASE_CONFIG: AppConfig = {
  nodeEnv: 'test',
  port: 8787,
  host: '127.0.0.1',
  publicOrigin: 'http://localhost:5173',
  allowedOrigins: ['http://localhost:5173', 'https://blogs.lovetulin.cn'],
  cookieDomain: undefined,
  cookieSecure: false,
  sessionSecret: 'test-secret-at-least-32-characters-long',
  sessionTtlSeconds: 180 * 24 * 60 * 60,
  sessionRefreshSeconds: 24 * 60 * 60,
  databasePath: ':memory:',
  githubClientId: 'github-client-id',
  githubClientSecret: 'github-client-secret',
  githubCallbackUrl: 'http://localhost:5173/api/auth/github/callback',
  smtp: null,
  smtpDryRun: true,
  adminEmails: ['admin@example.com'],
  twikooUpstream: 'http://twikoo.test',
  twikooTimeoutMs: 5000,
  maxBodyBytes: 1024 * 1024,
  emailCodeTtlSeconds: 600,
  emailCooldownSeconds: 60,
  emailHourlyLimit: 5,
  emailIpHourlyLimit: 20,
};

class MemoryMailer implements Mailer {
  email = '';
  code = '';

  async sendVerificationCode(email: string, code: string): Promise<void> {
    this.email = email;
    this.code = code;
  }
}

function cookieFrom(response: Response, name: string): string {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.split(/,(?=[^;]+=)/).find((item) => item.trim().startsWith(`${name}=`));
  if (!match) throw new Error(`missing cookie ${name}: ${setCookie}`);
  return match.split(';')[0]!.trim();
}

function makeClock(start = 1_700_000_000): { now: () => number; advance: (seconds: number) => void } {
  let value = start;
  return {
    now: () => value,
    advance: (seconds: number) => {
      value += seconds;
    },
  };
}

function makeGithubFetch(emails: Array<{ email: string; primary: boolean; verified: boolean }>) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes('access_token')) {
      return Response.json({ access_token: 'github-token' });
    }
    if (url.endsWith('/user')) {
      return Response.json({
        id: 12345,
        login: 'alice-gh',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      });
    }
    if (url.endsWith('/user/emails')) {
      return Response.json(emails);
    }
    return new Response('not found', { status: 404 });
  };
}

interface Harness {
  db: AuthDb;
  config: AppConfig;
  app: ReturnType<typeof createApp>;
  mailer: MemoryMailer;
  clock: ReturnType<typeof makeClock>;
  upstream: Array<{ url: string; init?: RequestInit }>;
}

function createHarness(options: {
  emails?: Array<{ email: string; primary: boolean; verified: boolean }>;
  config?: Partial<AppConfig>;
} = {}): Harness {
  const db = new AuthDb(':memory:');
  const config: AppConfig = { ...BASE_CONFIG, ...options.config };
  const clock = makeClock();
  const mailer = new MemoryMailer();
  const emailService = new EmailService(db, config, mailer, clock.now);
  const sessions = new SessionService(db, config, clock.now);
  const github = new GithubClient(config, makeGithubFetch(
    options.emails ?? [{ email: 'alice@example.com', primary: true, verified: true }],
  ) as typeof fetch);
  const upstream: Array<{ url: string; init?: RequestInit }> = [];
  const twikooFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    upstream.push({ url: String(input), init });
    return Response.json({ ok: true, event: 'GET_CONFIG' });
  };
  const app = createApp({
    db,
    config,
    sessions,
    emailService,
    github,
    fetchImpl: twikooFetch as typeof fetch,
    now: clock.now,
  });
  return { db, config, app, mailer, clock, upstream };
}

async function loginWithEmail(harness: Harness, email = 'alice@example.com'): Promise<string> {
  const send = await harness.app.request('/api/auth/email/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
    body: JSON.stringify({ email }),
  });
  expect(send.status).toBe(200);
  const verify = await harness.app.request('/api/auth/email/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
    body: JSON.stringify({ email, code: harness.mailer.code }),
  });
  expect(verify.status).toBe(200);
  return cookieFrom(verify, 'weno_session');
}

describe('auth gateway', () => {
  let current: Harness | null = null;

  afterEach(() => {
    current?.db.close();
    current = null;
  });

  it('healthz reports database availability', async () => {
    current = createHarness();
    const response = await current.app.request('/healthz');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('rejects anonymous comment submission before reaching Twikoo', async () => {
    current = createHarness();
    const response = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'COMMENT_SUBMIT', url: '/post', nick: 'a', mail: 'a@b.c', comment: 'hi' }),
    });
    expect(response.status).toBe(401);
    expect(current.upstream).toHaveLength(0);
  });

  it('rejects non-JSON bodies so the auth check cannot be skipped', async () => {
    current = createHarness();
    const response = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ event: 'COMMENT_SUBMIT', url: '/post', nick: 'a', mail: 'a@b.c', comment: 'hi' }),
    });
    expect(response.status).toBe(415);
    expect(current.upstream).toHaveLength(0);
  });

  it('overrides nick and mail with the logged-in identity', async () => {
    current = createHarness();
    const cookie = await loginWithEmail(current);
    const response = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        event: 'COMMENT_SUBMIT',
        url: '/post',
        nick: 'hacker',
        mail: 'hacker@example.com',
        comment: 'hi',
      }),
    });
    expect(response.status).toBe(200);
    expect(current.upstream).toHaveLength(1);
    const body = JSON.parse(new TextDecoder().decode(current.upstream[0]!.init?.body as ArrayBuffer)) as Record<string, string>;
    expect(body.nick).toBe('alice');
    expect(body.mail).toBe('alice@example.com');
    expect(body.comment).toBe('hi');
  });

  it('requires login for image upload but allows public reads', async () => {
    current = createHarness();
    const anonymousUpload = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'UPLOAD_IMAGE', image: 'data:image/png;base64,AA==' }),
    });
    expect(anonymousUpload.status).toBe(401);

    const publicRead = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'GET_CONFIG' }),
    });
    expect(publicRead.status).toBe(200);
    expect(current.upstream).toHaveLength(1);
  });

  it('revokes submissions immediately after logout', async () => {
    current = createHarness();
    const cookie = await loginWithEmail(current);
    const logout = await current.app.request('/api/auth/logout', {
      method: 'POST',
      headers: { cookie, origin: 'http://localhost:5173' },
    });
    expect(logout.status).toBe(204);
    const response = await current.app.request('/twikoo-api', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ event: 'COMMENT_SUBMIT', url: '/post', comment: 'hi' }),
    });
    expect(response.status).toBe(401);
  });

  it('updates the nickname and returns the new public user', async () => {
    current = createHarness();
    const cookie = await loginWithEmail(current);
    const response = await current.app.request('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: 'http://localhost:5173' },
      body: JSON.stringify({ nick: '  新昵称  ' }),
    });
    expect(response.status).toBe(200);
    const data = (await response.json()) as { user: { nick: string; email: string } };
    expect(data.user.nick).toBe('新昵称');
    expect(data.user.email).toBe('alice@example.com');
  });

  it('rate limits a second code request for the same email', async () => {
    current = createHarness();
    const first = await current.app.request('/api/auth/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(first.status).toBe(200);
    const second = await current.app.request('/api/auth/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('60');
  });

  it('invalidates a code after five wrong attempts', async () => {
    current = createHarness();
    await current.app.request('/api/auth/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'alice@example.com' }),
    });
    const code = current.mailer.code;
    for (let index = 0; index < 5; index += 1) {
      const response = await current.app.request('/api/auth/email/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
        body: JSON.stringify({ email: 'alice@example.com', code: '000000' }),
      });
      expect(response.status).toBe(400);
    }
    const correct = await current.app.request('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ email: 'alice@example.com', code }),
    });
    expect(correct.status).toBe(400);
  });

  it('uses state and a verified GitHub email to log in', async () => {
    current = createHarness();
    const start = await current.app.request('/api/auth/github?redirect=%2Fpost%3Fa%3D1');
    expect(start.status).toBe(302);
    const location = new URL(start.headers.get('location') ?? '');
    expect(location.hostname).toBe('github.com');
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    const stateCookie = cookieFrom(start, 'weno_oauth_state');

    const callback = await current.app.request(
      `/api/auth/github/callback?code=abc&state=${encodeURIComponent(state ?? '')}`,
      { headers: { cookie: stateCookie } },
    );
    expect(callback.status).toBe(302);
    const redirect = new URL(callback.headers.get('location') ?? '');
    expect(redirect.origin).toBe('http://localhost:5173');
    expect(redirect.pathname).toBe('/post');
    expect(redirect.searchParams.get('a')).toBe('1');
    expect(redirect.searchParams.get('auth')).toBe('success');
    expect(current.db.findUserByEmail('alice@example.com')?.nick).toBe('alice-gh');
  });

  it('rejects a GitHub account without a verified email', async () => {
    current = createHarness({
      emails: [{ email: 'alice@example.com', primary: true, verified: false }],
    });
    const start = await current.app.request('/api/auth/github');
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state');
    const stateCookie = cookieFrom(start, 'weno_oauth_state');
    const callback = await current.app.request(
      `/api/auth/github/callback?code=abc&state=${encodeURIComponent(state ?? '')}`,
      { headers: { cookie: stateCookie } },
    );
    const redirect = new URL(callback.headers.get('location') ?? '');
    expect(redirect.searchParams.get('auth')).toBe('error');
    expect(redirect.searchParams.get('reason')).toBe('email_unverified');
    expect(current.db.findUserByEmail('alice@example.com')).toBeNull();
  });

  it('slides the session expiry on activity', () => {
    current = createHarness();
    const session = current.db.createUser({
      email: 'slide@example.com',
      nick: 'slide',
      now: current.clock.now(),
    });
    const service = new SessionService(current.db, current.config, current.clock.now);
    const issued = service.issue(session.id);
    const before = current.db.findSession(hashToken(issued.token));
    expect(before).not.toBeNull();
    current.clock.advance(2 * 24 * 60 * 60);
    const resolved = service.resolve(issued.token);
    expect(resolved?.refreshed).toBe(true);
    const after = current.db.findSession(hashToken(issued.token));
    expect(after!.expiresAt).toBeGreaterThan(before!.expiresAt);
  });
});
