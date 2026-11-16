import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

interface StatePayload {
  state: string;
  redirect: string;
  exp: number;
}

export const OAUTH_STATE_COOKIE = 'weno_oauth_state';
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function sign(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function sanitizeRedirect(input: unknown, origin: string): string {
  if (typeof input !== 'string' || !input) return '/';
  if (!input.startsWith('/') || input.startsWith('//') || input.includes('\\')) return '/';
  if (/[\u0000-\u001f\u007f]/.test(input)) return '/';
  try {
    const url = new URL(input, origin);
    if (url.origin !== origin) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

export function createOAuthState(
  secret: string,
  redirect: string,
  now: number = Math.floor(Date.now() / 1000),
): string {
  const payload: StatePayload = {
    state: randomBytes(16).toString('base64url'),
    redirect,
    exp: now + OAUTH_STATE_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(secret, encoded)}`;
}

export function verifyOAuthState(
  secret: string,
  value: string | undefined,
  now: number = Math.floor(Date.now() / 1000),
): StatePayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(secret, encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload;
    if (
      typeof payload.state !== 'string' ||
      typeof payload.redirect !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
