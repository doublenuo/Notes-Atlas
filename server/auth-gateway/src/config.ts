/** 运行时配置。所有值从环境变量读取，测试可直接构造对象。 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  host: string;
  publicOrigin: string;
  allowedOrigins: string[];
  cookieDomain?: string;
  cookieSecure: boolean;
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionRefreshSeconds: number;
  databasePath: string;
  githubClientId?: string;
  githubClientSecret?: string;
  githubCallbackUrl: string;
  smtp: SmtpConfig | null;
  smtpDryRun: boolean;
  adminEmails: string[];
  twikooUpstream: string;
  twikooTimeoutMs: number;
  maxBodyBytes: number;
  emailCodeTtlSeconds: number;
  emailCooldownSeconds: number;
  emailHourlyLimit: number;
  emailIpHourlyLimit: number;
}

type Env = Record<string, string | undefined>;

function text(env: Env, name: string, fallback = ''): string {
  return (env[name] ?? fallback).trim();
}

function required(env: Env, name: string): string {
  const value = text(env, name);
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const value = text(env, name);
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function integer(env: Env, name: string, fallback: number): number {
  const value = Number(text(env, name));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function list(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function loadConfig(env: Env = process.env): AppConfig {
  const nodeEnv = text(env, 'NODE_ENV', 'development');
  const publicOrigin = text(env, 'PUBLIC_ORIGIN', 'http://localhost:5173').replace(/\/+$/, '');
  const smtpDryRun = bool(env, 'SMTP_DRY_RUN', nodeEnv !== 'production');
  const smtpUser = text(env, 'SMTP_USER');
  const smtpPass = text(env, 'SMTP_PASS');
  const mailFrom = text(env, 'MAIL_FROM');

  const smtpConfigured = Boolean(smtpUser && smtpPass && mailFrom);
  const smtp =
    !smtpDryRun && smtpConfigured
      ? {
          host: text(env, 'SMTP_HOST', 'smtpdm.aliyun.com'),
          port: integer(env, 'SMTP_PORT', 465),
          secure: bool(env, 'SMTP_SECURE', true),
          user: smtpUser,
          pass: smtpPass,
          from: mailFrom,
        }
      : null;

  if (!smtpDryRun && !smtp) {
    throw new Error('SMTP_DRY_RUN=false 时必须配置 SMTP_USER/SMTP_PASS/MAIL_FROM');
  }

  const allowedOrigins = unique([
    publicOrigin,
    'https://comments.lovetulin.cn',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...list(text(env, 'ALLOWED_ORIGINS')),
  ]);

  return {
    nodeEnv,
    port: integer(env, 'PORT', 8787),
    host: text(env, 'HOST', '127.0.0.1'),
    publicOrigin,
    allowedOrigins,
    cookieDomain: text(env, 'COOKIE_DOMAIN') || undefined,
    cookieSecure: bool(env, 'COOKIE_SECURE', nodeEnv === 'production'),
    sessionSecret: required(env, 'SESSION_SECRET'),
    sessionTtlSeconds: integer(env, 'SESSION_TTL_DAYS', 180) * 24 * 60 * 60,
    sessionRefreshSeconds: integer(env, 'SESSION_REFRESH_HOURS', 24) * 60 * 60,
    databasePath: text(env, 'DATABASE_PATH', './data/auth.db'),
    githubClientId: text(env, 'GITHUB_CLIENT_ID') || undefined,
    githubClientSecret: text(env, 'GITHUB_CLIENT_SECRET') || undefined,
    githubCallbackUrl:
      text(env, 'GITHUB_CALLBACK_URL') || `${publicOrigin}/api/auth/github/callback`,
    smtp,
    smtpDryRun,
    adminEmails: list(text(env, 'ADMIN_EMAILS')).map((email) => email.toLowerCase()),
    twikooUpstream: text(env, 'TWIKOO_UPSTREAM', 'http://127.0.0.1:8080').replace(/\/+$/, ''),
    twikooTimeoutMs: integer(env, 'TWIKOO_TIMEOUT_MS', 30_000),
    maxBodyBytes: integer(env, 'MAX_BODY_MB', 20) * 1024 * 1024,
    emailCodeTtlSeconds: integer(env, 'EMAIL_CODE_TTL_MINUTES', 10) * 60,
    emailCooldownSeconds: integer(env, 'EMAIL_COOLDOWN_SECONDS', 60),
    emailHourlyLimit: integer(env, 'EMAIL_HOURLY_LIMIT', 5),
    emailIpHourlyLimit: integer(env, 'EMAIL_IP_HOURLY_LIMIT', 20),
  };
}
