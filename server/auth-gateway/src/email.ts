import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { AppConfig } from './config.js';
import type { AuthDb, User } from './db.js';
import { InvalidCodeError, MailDeliveryError, RateLimitError, ValidationError } from './errors.js';
import { cleanNick, defaultNickFromEmail, normalizeEmail, qqAvatarUrl } from './nick.js';

export interface Mailer {
  sendVerificationCode(email: string, code: string): Promise<void>;
}

export class SmtpMailer implements Mailer {
  private readonly transport: ReturnType<typeof nodemailer.createTransport>;

  constructor(private readonly config: NonNullable<AppConfig['smtp']>) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.transport.sendMail({
      from: this.config.from,
      to: email,
      subject: '登录验证码',
      text: [
        `你的登录验证码是：${code}`,
        '',
        '验证码 10 分钟内有效，仅可使用一次。',
        '如果这不是你本人的操作，请忽略这封邮件。',
        '',
        "Weno's Blog",
      ].join('\n'),
      html: [
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;line-height:1.7;color:#222">',
        '<p>你的登录验证码是：</p>',
        `<p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>`,
        '<p>验证码 10 分钟内有效，仅可使用一次。</p>',
        '<p style="color:#888">如果这不是你本人的操作，请忽略这封邮件。</p>',
        "<p style=\"color:#888\">Weno's Blog</p>",
        '</div>',
      ].join(''),
    });
  }
}

export class DryRunMailer implements Mailer {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    console.info(`[auth] SMTP_DRY_RUN 验证码 ${email} -> ${code}`);
  }
}

export class EmailService {
  private readonly db: AuthDb;
  private readonly config: AppConfig;
  private readonly mailer: Mailer;
  private readonly now: () => number;
  private readonly ipSends = new Map<string, number[]>();

  constructor(
    db: AuthDb,
    config: AppConfig,
    mailer: Mailer,
    now: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.db = db;
    this.config = config;
    this.mailer = mailer;
    this.now = now;
  }

  private codeHash(email: string, code: string): Buffer {
    return createHmac('sha256', this.config.sessionSecret).update(`${email}:${code}`).digest();
  }

  private checkIpLimit(ip: string, now: number): void {
    const key = ip || 'unknown';
    const recent = (this.ipSends.get(key) ?? []).filter(
      (timestamp) => timestamp > now - 60 * 60,
    );
    if (recent.length >= this.config.emailIpHourlyLimit) {
      this.ipSends.set(key, recent);
      throw new RateLimitError('请求过于频繁，请稍后再试', 60 * 60);
    }
    recent.push(now);
    this.ipSends.set(key, recent);
  }

  async sendVerificationCode(emailInput: unknown, ip: string): Promise<{ retryAfter: number }> {
    const email = normalizeEmail(emailInput);
    if (!email) throw new ValidationError('请输入有效的邮箱地址');

    const now = this.now();
    const lastAt = this.db.lastEmailCodeAt(email);
    if (lastAt !== null && lastAt + this.config.emailCooldownSeconds > now) {
      throw new RateLimitError(
        '验证码发送过于频繁，请稍后再试',
        lastAt + this.config.emailCooldownSeconds - now,
      );
    }
    const hourly = this.db.countEmailCodesSince(email, now - 60 * 60);
    if (hourly >= this.config.emailHourlyLimit) {
      throw new RateLimitError('该邮箱发送次数过多，请稍后再试', 60 * 60);
    }
    this.checkIpLimit(ip, now);

    const code = String(randomInt(1, 1_000_000)).padStart(6, '0');
    this.db.invalidateEmailCodes(email, now);
    const id = this.db.insertEmailCode({
      email,
      codeHash: this.codeHash(email, code).toString('hex'),
      createdAt: now,
      expiresAt: now + this.config.emailCodeTtlSeconds,
    });

    try {
      await this.mailer.sendVerificationCode(email, code);
    } catch (error) {
      this.db.deleteEmailCode(id);
      console.error('[auth] 验证码邮件发送失败', error instanceof Error ? error.message : error);
      throw new MailDeliveryError();
    }

    return { retryAfter: this.config.emailCooldownSeconds };
  }

  verifyCode(emailInput: unknown, codeInput: unknown): User {
    const email = normalizeEmail(emailInput);
    if (!email) throw new ValidationError('请输入有效的邮箱地址');
    const code = typeof codeInput === 'string' ? codeInput.trim() : '';
    if (!/^\d{6}$/.test(code)) throw new InvalidCodeError();

    const now = this.now();
    const row = this.db.latestEmailCode(email);
    if (!row || row.expiresAt <= now || row.attempts >= 5) {
      throw new InvalidCodeError();
    }

    const expected = Buffer.from(row.codeHash, 'hex');
    const actual = this.codeHash(email, code);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      this.db.incrementEmailCodeAttempts(row.id);
      throw new InvalidCodeError();
    }

    this.db.consumeEmailCode(row.id, now);
    return this.findOrCreateUser(email, now);
  }

  private findOrCreateUser(email: string, now: number): User {
    const existing = this.db.findUserByEmail(email);
    if (existing) {
      const qqAvatar = qqAvatarUrl(email);
      if (qqAvatar && !existing.avatarUrl) {
        this.db.updateAvatar(existing.id, qqAvatar, now);
        return this.db.findUserById(existing.id) ?? existing;
      }
      return existing;
    }

    const nick = cleanNick(defaultNickFromEmail(email)) || '读者';
    try {
      return this.db.createUser({ email, nick, avatarUrl: qqAvatarUrl(email), now });
    } catch (error) {
      // 并发下可能已被另一个请求创建；重新读取。
      const raced = this.db.findUserByEmail(email);
      if (raced) return raced;
      throw error;
    }
  }
}
