import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import type { AppConfig } from './config.js';
import type { AuthDb } from './db.js';
import type { SessionService } from './session.js';

interface TwikooDeps {
  db: AuthDb;
  config: AppConfig;
  sessions: SessionService;
  fetchImpl?: typeof fetch;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonContentType(value: string | undefined): boolean {
  return Boolean(value && value.toLowerCase().includes('application/json'));
}

function hashHex(algorithm: 'sha256' | 'md5', value: string): string {
  return createHash(algorithm).update(value).digest('hex');
}

function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Twikoo 只会在评论里保存邮箱哈希，不会保存 GitHub 头像。
 * 这里把登录用户的头像映射到邮箱哈希，并在 COMMENT_GET 响应里补上 avatar。
 */
function avatarMap(db: AuthDb): Map<string, string> {
  const map = new Map<string, string>();
  for (const { email, avatarUrl } of db.listUserAvatars()) {
    const avatar = safeAvatarUrl(avatarUrl);
    if (!avatar) continue;
    const normalized = email.trim().toLowerCase();
    map.set(hashHex('sha256', normalized), avatar);
    map.set(hashHex('md5', normalized), avatar);
  }
  return map;
}

function decorateCommentAvatars(value: unknown, avatars: Map<string, string>): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (!isJsonObject(item)) continue;
    const mailMd5 = typeof item.mailMd5 === 'string' ? item.mailMd5.toLowerCase() : '';
    const avatar = mailMd5 ? avatars.get(mailMd5) : undefined;
    if (avatar && !item.avatar) item.avatar = avatar;
    if (Array.isArray(item.replies)) decorateCommentAvatars(item.replies, avatars);
  }
}

function copyResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of [
    'content-type',
    'cache-control',
    'content-disposition',
    'content-language',
    'etag',
    'last-modified',
  ]) {
    const value = response.headers.get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

export function createTwikooProxy(
  deps: TwikooDeps,
  stripApiPrefix: boolean,
): (c: Context) => Promise<Response> {
  const { db, config, sessions } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  return async (c) => {
    const method = c.req.method;
    const hasBody = !['GET', 'HEAD'].includes(method);
    const contentLength = Number(c.req.header('content-length') ?? '0');
    if (contentLength > config.maxBodyBytes) {
      return c.json({ error: 'payload_too_large', message: '请求体过大' }, 413);
    }

    let bodyBuffer: ArrayBuffer | undefined;
    let body: JsonObject | undefined;
    if (hasBody) {
      // Twikoo 的事件请求全部是 JSON。这里必须拒绝非 JSON，否则攻击者可以把
      // COMMENT_SUBMIT 的 content-type 改成 text/plain，让 event 解析不到而绕过登录校验。
      if (!isJsonContentType(c.req.header('content-type'))) {
        return c.json({ error: 'unsupported_media_type', message: '请求必须使用 application/json' }, 415);
      }
      bodyBuffer = await c.req.arrayBuffer();
      if (bodyBuffer.byteLength > config.maxBodyBytes) {
        return c.json({ error: 'payload_too_large', message: '请求体过大' }, 413);
      }
      try {
        const parsed = JSON.parse(new TextDecoder().decode(bodyBuffer)) as unknown;
        if (!isJsonObject(parsed)) {
          return c.json({ error: 'invalid_body', message: '请求格式错误' }, 400);
        }
        body = parsed;
      } catch {
        return c.json({ error: 'invalid_json', message: '请求格式错误' }, 400);
      }
    }

    const event = typeof body?.event === 'string' ? body.event : '';
    if (event === 'COMMENT_SUBMIT' || event === 'UPLOAD_IMAGE') {
      const user = sessions.currentUser(c);
      if (!user) {
        return c.json({ error: 'unauthorized', message: '请先登录后再评论' }, 401);
      }
      if (event === 'COMMENT_SUBMIT' && body) {
        body.nick = user.nick;
        body.mail = user.email;
        bodyBuffer = new TextEncoder().encode(JSON.stringify(body)).buffer;
      }
    }

    const requestPath = new URL(c.req.url).pathname;
    const upstreamPath = stripApiPrefix
      ? requestPath.replace(/^\/twikoo-api/, '') || '/'
      : requestPath;
    const query = new URL(c.req.url).search;
    const upstreamUrl = `${config.twikooUpstream}${upstreamPath}${query}`;

    const headers = new Headers();
    const contentType = c.req.header('content-type');
    if (contentType) headers.set('content-type', contentType);
    const accept = c.req.header('accept');
    if (accept) headers.set('accept', accept);
    const userAgent = c.req.header('user-agent');
    if (userAgent) headers.set('user-agent', userAgent);
    const forwardedFor = c.req.header('x-forwarded-for');
    if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
    const realIp = c.req.header('x-real-ip');
    if (realIp) headers.set('x-real-ip', realIp);

    try {
      const response = await fetchImpl(upstreamUrl, {
        method,
        headers,
        body: bodyBuffer && method !== 'GET' && method !== 'HEAD' ? bodyBuffer : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(config.twikooTimeoutMs),
      });
      const responseHeaders = copyResponseHeaders(response);
      if (response.status === 204 || response.status === 304) {
        return c.body(null, response.status as 204, responseHeaders);
      }
      let responseBody = await response.arrayBuffer();
      if (event === 'COMMENT_GET' && response.ok) {
        try {
          const payload = JSON.parse(new TextDecoder().decode(responseBody)) as unknown;
          if (isJsonObject(payload) && Array.isArray(payload.data)) {
            decorateCommentAvatars(payload.data, avatarMap(db));
            responseBody = new TextEncoder().encode(JSON.stringify(payload)).buffer;
          }
        } catch {
          // 上游返回非 JSON 时保持原响应，不影响评论读取。
        }
      }
      return c.body(responseBody, response.status as 200, responseHeaders);
    } catch (error) {
      console.error(
        '[twikoo] 上游请求失败',
        error instanceof Error ? error.message : String(error),
      );
      return c.json({ error: 'twikoo_unavailable', message: '评论服务暂时不可用' }, 502);
    }
  };
}
