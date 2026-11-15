export interface AuthUser {
  id: number
  nick: string
  email: string
  emailVerified: boolean
  avatarUrl: string | null
  isAdmin: boolean
}

interface ApiErrorBody {
  error?: string
  message?: string
  retryAfter?: number
}

export class AuthApiError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || '请求失败，请稍后重试')
    this.name = 'AuthApiError'
    this.status = status
    this.code = body.error || 'request_failed'
    this.retryAfter = body.retryAfter
  }
}

const API_BASE = '/api/auth'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'application/json')

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    signal: init.signal ?? AbortSignal.timeout(15_000),
  })

  if (response.status === 204) return undefined as T

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // 网关异常时可能返回空 body
  }

  if (!response.ok) {
    throw new AuthApiError(response.status, (body || {}) as ApiErrorBody)
  }

  return body as T
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const data = await request<{ user: AuthUser }>('/me')
    return data.user
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null
    throw error
  }
}

export async function sendEmailCode(email: string): Promise<{ ok: true; retryAfter?: number }> {
  return request('/email/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function verifyEmailCode(email: string, code: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/email/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })
  return data.user
}

export async function updateNickname(nick: string): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ nick }),
  })
  return data.user
}

export async function logout(): Promise<void> {
  await request('/logout', { method: 'POST' })
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0] || ''}***@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

export const GITHUB_LOGIN_URL = (redirect: string) =>
  `${API_BASE}/github?redirect=${encodeURIComponent(redirect)}`
