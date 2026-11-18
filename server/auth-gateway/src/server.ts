import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { AuthDb } from './db.js';
import { DryRunMailer, EmailService, SmtpMailer, type Mailer } from './email.js';
import { GithubClient } from './github.js';
import { qqAvatarUrl } from './nick.js';
import { SessionService } from './session.js';

const config = loadConfig();
const db = new AuthDb(config.databasePath);
const sessions = new SessionService(db, config);
const mailer: Mailer =
  config.smtpDryRun || !config.smtp ? new DryRunMailer() : new SmtpMailer(config.smtp);
const emailService = new EmailService(db, config, mailer);
const github = new GithubClient(config);
const app = createApp({ db, config, sessions, emailService, github });

function backfillQqAvatars(): void {
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  for (const user of db.listUsersWithoutAvatar()) {
    const avatar = qqAvatarUrl(user.email);
    if (!avatar) continue;
    db.updateAvatar(user.id, avatar, now);
    count += 1;
  }
  if (count > 0) console.info(`[gateway] 已为 ${count} 个 QQ 邮箱用户补全头像`);
}

function cleanup(): void {
  const now = Math.floor(Date.now() / 1000);
  db.deleteExpiredSessions(now);
  db.deleteExpiredEmailCodes(now);
}

backfillQqAvatars();
cleanup();
const timer = setInterval(cleanup, 60 * 60 * 1000);
timer.unref();

const server = serve(
  {
    fetch: app.fetch,
    hostname: config.host,
    port: config.port,
  },
  (info) => {
    console.info(`[gateway] listening on http://${info.address}:${info.port}`);
    console.info(`[gateway] Twikoo upstream: ${config.twikooUpstream}`);
    if (config.smtpDryRun) console.info('[gateway] SMTP_DRY_RUN 已开启，验证码只写入日志');
    if (!github.configured) console.info('[gateway] GitHub OAuth 未配置');
  },
);

function shutdown(signal: string): void {
  console.info(`[gateway] 收到 ${signal}，正在关闭`);
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
