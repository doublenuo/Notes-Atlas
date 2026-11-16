import type { AuthUser } from './client'

const META_KEY = 'twikoo'

interface TwikooMeta {
  nick?: string
  mail?: string
  link?: string
}

function readMeta(): TwikooMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as TwikooMeta
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMeta(meta: TwikooMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage 不可用时只依赖 onSubmit 兜底
  }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function applyToDom(user: AuthUser | null) {
  if (typeof document === 'undefined') return
  const nick = document.querySelector<HTMLInputElement>('#twikoo .tk-meta-input input[name="nick"]')
  const mail = document.querySelector<HTMLInputElement>('#twikoo .tk-meta-input input[name="mail"]')
  if (nick) setInputValue(nick, user?.nick || '')
  if (mail) setInputValue(mail, user?.email || '')
}

/**
 * Twikoo 自己会把 meta 存在 localStorage，并在提交时读取输入框。
 * 登录后同步一份，既能让评论区显示正确身份，也能覆盖“先输入、后登录”的旧值。
 * DOM 可能还没挂载，所以安排几次重试；真正可信的身份仍由网关覆盖。
 */
export function syncTwikooIdentity(user: AuthUser | null) {
  if (typeof window === 'undefined') return

  const meta = readMeta()
  writeMeta({
    ...meta,
    nick: user?.nick || '',
    mail: user?.email || '',
  })

  applyToDom(user)
  for (const delay of [80, 300, 900, 2000, 4000]) {
    window.setTimeout(() => applyToDom(user), delay)
  }
}
