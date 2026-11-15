import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppConfig } from './config.js';
import type { AuthDb, User } from './db.js';

export const SESSION_COOKIE = 'weno_session';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionResolution {
  user: User;
  refreshed: boolean;
}

export class SessionService {
  private readonly db: AuthDb;
  private readonly config: AppConfig;
  private readonly now: () => number;

  constructor(db: AuthDb, config: AppConfig, now: () => number = () => Math.floor(Date.now() / 1000)) {
    this.db = db;
    this.config = config;
    this.now = now;
  }

  issue(userId: number): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url');
    const createdAt = this.now();
    const expiresAt = createdAt + this.config.sessionTtlSeconds;
    this.db.createSession({
      tokenHash: hashToken(token),
      userId,
      createdAt,
      expiresAt,
    });
    return { token, expiresAt };
  }

  resolve(token: string | undefined): SessionResolution | null {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = this.db.findSession(tokenHash);
    if (!session) return null;
    const now = this.now();
    if (session.expiresAt <= now) {
      this.db.deleteSession(tokenHash);
      return null;
    }
    if (session.lastSeenAt + this.config.sessionRefreshSeconds <= now) {
      const expiresAt = now + this.config.sessionTtlSeconds;
      this.db.touchSession(tokenHash, now, expiresAt);
      const user = this.db.findUserById(session.userId);
      return user ? { user, refreshed: true } : null;
    }
    const user = this.db.findUserById(session.userId);
    return user ? { user, refreshed: false } : null;
  }

  destroy(token: string | undefined): void {
    if (!token) return;
    this.db.deleteSession(hashToken(token));
  }

  readToken(c: Context): string | undefined {
    return getCookie(c, SESSION_COOKIE);
  }

  setCookie(c: Context, token: string): void {
    setCookie(c, SESSION_COOKIE, token, {
      path: '/',
      domain: this.config.cookieDomain,
      secure: this.config.cookieSecure,
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: this.config.sessionTtlSeconds,
    });
  }

  clearCookie(c: Context): void {
    deleteCookie(c, SESSION_COOKIE, {
      path: '/',
      domain: this.config.cookieDomain,
      secure: this.config.cookieSecure,
    });
  }

  currentUser(c: Context): User | null {
    const token = this.readToken(c);
    if (!token) return null;
    const resolved = this.resolve(token);
    if (!resolved) {
      this.clearCookie(c);
      return null;
    }
    if (resolved.refreshed) this.setCookie(c, token);
    return resolved.user;
  }
}
