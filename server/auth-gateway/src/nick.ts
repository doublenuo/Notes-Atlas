const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const CONTROL_RE = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const FORBIDDEN_NICK_RE = /[<>]/g;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function cleanNick(input: unknown): string {
  if (typeof input !== 'string') return '';
  const value = input
    .trim()
    .replace(CONTROL_RE, '')
    .replace(FORBIDDEN_NICK_RE, '')
    .replace(/\s+/g, ' ');
  return value;
}

export type NickResult = { ok: true; value: string } | { ok: false; reason: string };

export function validateNick(input: unknown): NickResult {
  const value = cleanNick(input);
  const length = Array.from(value).length;
  if (length === 0) return { ok: false, reason: '昵称不能为空' };
  if (length > 20) return { ok: false, reason: '昵称最多 20 个字符' };
  return { ok: true, value };
}

function truncateNick(value: string): string {
  return Array.from(value).slice(0, 20).join('').trim();
}

export function defaultNickFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const value = truncateNick(cleanNick(local.split('+')[0] ?? ''));
  return value || '读者';
}

export function defaultNickFromGithub(login: string | null | undefined): string {
  const value = truncateNick(cleanNick(login ?? ''));
  return value || '读者';
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local.slice(0, 1)}***@${domain}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`;
}

export function isAdminEmail(email: string, adminEmails: string[]): boolean {
  return adminEmails.includes(email.toLowerCase());
}
