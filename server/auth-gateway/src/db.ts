import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface User {
  id: number;
  email: string;
  emailVerifiedAt: number;
  nick: string;
  githubId: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRow {
  tokenHash: string;
  userId: number;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
}

export interface EmailCodeRow {
  id: number;
  email: string;
  codeHash: string;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

interface UserDbRow {
  id: number;
  email: string;
  email_verified_at: number;
  nick: string;
  github_id: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

interface SessionDbRow {
  token_hash: string;
  user_id: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}

interface EmailCodeDbRow {
  id: number;
  email: string;
  code_hash: string;
  attempts: number;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
}

export function toUser(row: UserDbRow): User {
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    nick: row.nick,
    githubId: row.github_id,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSession(row: SessionDbRow): SessionRow {
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  };
}

function toEmailCode(row: EmailCodeDbRow): EmailCodeRow {
  return {
    id: row.id,
    email: row.email,
    codeHash: row.code_hash,
    attempts: row.attempts,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified_at INTEGER NOT NULL,
  nick TEXT NOT NULL,
  github_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS email_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email, id DESC);
CREATE INDEX IF NOT EXISTS idx_email_codes_expires ON email_codes(expires_at);
`;

export class AuthDb {
  readonly raw: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA journal_mode = WAL;');
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA busy_timeout = 5000;');
    this.raw.exec(SCHEMA);
  }

  close(): void {
    this.raw.close();
  }

  ping(): boolean {
    const row = this.raw.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined;
    return row?.ok === 1;
  }

  findUserById(id: number): User | null {
    const row = this.raw.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserDbRow
      | undefined;
    return row ? toUser(row) : null;
  }

  findUserByEmail(email: string): User | null {
    const row = this.raw.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      | UserDbRow
      | undefined;
    return row ? toUser(row) : null;
  }

  findUserByGithubId(githubId: string): User | null {
    const row = this.raw
      .prepare('SELECT * FROM users WHERE github_id = ?')
      .get(githubId) as UserDbRow | undefined;
    return row ? toUser(row) : null;
  }

  listUsersWithoutAvatar(): Array<{ id: number; email: string }> {
    return this.raw
      .prepare(
        "SELECT id, email FROM users WHERE avatar_url IS NULL OR avatar_url = '' OR avatar_url LIKE 'https://q1.qlogo.cn/%' OR avatar_url LIKE 'https://q2.qlogo.cn/%'",
      )
      .all() as Array<{ id: number; email: string }>;
  }

  listUserAvatars(): Array<{ email: string; avatarUrl: string }> {
    const rows = this.raw
      .prepare(
        "SELECT email, avatar_url FROM users WHERE avatar_url IS NOT NULL AND avatar_url <> ''",
      )
      .all() as Array<{ email: string; avatar_url: string }>;
    return rows.map((row) => ({ email: row.email, avatarUrl: row.avatar_url }));
  }

  createUser(input: {
    email: string;
    nick: string;
    githubId?: string | null;
    avatarUrl?: string | null;
    now: number;
  }): User {
    const result = this.raw
      .prepare(
        `INSERT INTO users
          (email, email_verified_at, nick, github_id, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.email,
        input.now,
        input.nick,
        input.githubId ?? null,
        input.avatarUrl ?? null,
        input.now,
        input.now,
      );
    const user = this.findUserById(Number(result.lastInsertRowid));
    if (!user) throw new Error('创建用户失败');
    return user;
  }

  linkGithub(userId: number, githubId: string, avatarUrl: string | null, now: number): User {
    this.raw
      .prepare('UPDATE users SET github_id = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?')
      .run(githubId, avatarUrl, now, userId);
    const user = this.findUserById(userId);
    if (!user) throw new Error('更新 GitHub 绑定失败');
    return user;
  }

  updateAvatar(userId: number, avatarUrl: string | null, now: number): void {
    this.raw
      .prepare('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?')
      .run(avatarUrl, now, userId);
  }

  updateNick(userId: number, nick: string, now: number): User {
    this.raw
      .prepare('UPDATE users SET nick = ?, updated_at = ? WHERE id = ?')
      .run(nick, now, userId);
    const user = this.findUserById(userId);
    if (!user) throw new Error('更新昵称失败');
    return user;
  }

  createSession(input: {
    tokenHash: string;
    userId: number;
    createdAt: number;
    expiresAt: number;
  }): void {
    this.raw
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.tokenHash, input.userId, input.createdAt, input.createdAt, input.expiresAt);
  }

  findSession(tokenHash: string): SessionRow | null {
    const row = this.raw.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as
      | SessionDbRow
      | undefined;
    return row ? toSession(row) : null;
  }

  touchSession(tokenHash: string, lastSeenAt: number, expiresAt: number): void {
    this.raw
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
      .run(lastSeenAt, expiresAt, tokenHash);
  }

  deleteSession(tokenHash: string): void {
    this.raw.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  deleteExpiredSessions(now: number): void {
    this.raw.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }

  invalidateEmailCodes(email: string, now: number): void {
    this.raw
      .prepare('UPDATE email_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL')
      .run(now, email);
  }

  insertEmailCode(input: {
    email: string;
    codeHash: string;
    createdAt: number;
    expiresAt: number;
  }): number {
    const result = this.raw
      .prepare(
        `INSERT INTO email_codes (email, code_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(input.email, input.codeHash, input.createdAt, input.expiresAt);
    return Number(result.lastInsertRowid);
  }

  deleteEmailCode(id: number): void {
    this.raw.prepare('DELETE FROM email_codes WHERE id = ?').run(id);
  }

  latestEmailCode(email: string): EmailCodeRow | null {
    const row = this.raw
      .prepare(
        'SELECT * FROM email_codes WHERE email = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1',
      )
      .get(email) as EmailCodeDbRow | undefined;
    return row ? toEmailCode(row) : null;
  }

  incrementEmailCodeAttempts(id: number): void {
    this.raw.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?').run(id);
  }

  consumeEmailCode(id: number, now: number): void {
    this.raw
      .prepare('UPDATE email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
      .run(now, id);
  }

  countEmailCodesSince(email: string, since: number): number {
    const row = this.raw
      .prepare('SELECT COUNT(*) AS count FROM email_codes WHERE email = ? AND created_at >= ?')
      .get(email, since) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  lastEmailCodeAt(email: string): number | null {
    const row = this.raw
      .prepare('SELECT created_at FROM email_codes WHERE email = ? ORDER BY id DESC LIMIT 1')
      .get(email) as { created_at: number } | undefined;
    return row?.created_at ?? null;
  }

  deleteExpiredEmailCodes(now: number): void {
    this.raw.prepare('DELETE FROM email_codes WHERE expires_at <= ?').run(now);
  }
}
