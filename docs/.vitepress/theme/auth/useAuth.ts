import { computed, ref } from 'vue'
import type { AuthUser } from './client'
import { AuthApiError, fetchMe, logout as apiLogout, updateNickname } from './client'
import { syncTwikooIdentity } from './twikoo'

export type LoginTab = 'github' | 'email'

const user = ref<AuthUser | null>(null)
const ready = ref(false)
const dialogOpen = ref(false)
const loginTab = ref<LoginTab>('github')
const loginReason = ref('')
const notice = ref('')
const authError = ref('')

let initPromise: Promise<void> | null = null
let authQueryHandled = false
let bridgeInstalled = false

function setUser(next: AuthUser | null) {
  user.value = next
  ;(globalThis as { __WENO_AUTH_USER__?: AuthUser | null }).__WENO_AUTH_USER__ = next

  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.classList.remove('auth-pending')
    root.classList.add('auth-ready')
    root.classList.toggle('auth-logged-in', Boolean(next))
  }

  syncTwikooIdentity(next)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('weno:auth-changed', { detail: next }))
  }
}

function installAuthBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return
  bridgeInstalled = true
  window.addEventListener('weno:auth-required', () => {
    openLogin('登录后即可评论')
  })
}

function markReady() {
  ready.value = true
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('auth-pending')
    document.documentElement.classList.add('auth-ready')
    document.documentElement.classList.toggle('auth-logged-in', Boolean(user.value))
  }
}

const AUTH_ERROR_TEXT: Record<string, string> = {
  access_denied: '你取消了 GitHub 授权。',
  invalid_state: 'GitHub 登录状态已失效，请重新试一次。',
  email_unverified: '这个 GitHub 账号没有已验证的邮箱，请先在 GitHub 验证邮箱。',
  email_conflict: '该邮箱已绑定其他 GitHub 账号，请联系站长处理。',
  github_failed: 'GitHub 登录失败，请稍后重试。',
}

function handleAuthQuery() {
  if (authQueryHandled || typeof window === 'undefined') return
  authQueryHandled = true
  const url = new URL(window.location.href)
  const status = url.searchParams.get('auth')
  if (!status) return

  const reason = url.searchParams.get('reason') || ''
  if (status === 'success') {
    notice.value = '登录成功，现在可以评论了。'
  } else if (status === 'error') {
    notice.value = AUTH_ERROR_TEXT[reason] || '登录没有完成，请重试。'
  }

  url.searchParams.delete('auth')
  url.searchParams.delete('reason')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export async function initAuth(): Promise<void> {
  if (initPromise) return initPromise
  if (typeof window === 'undefined') return

  installAuthBridge()
  document.documentElement.classList.add('auth-pending')

  initPromise = (async () => {
    try {
      const current = await fetchMe()
      setUser(current)
    } catch (error) {
      authError.value =
        error instanceof AuthApiError
          ? error.message
          : '登录状态暂时无法读取，评论功能可能不可用。'
      setUser(null)
    } finally {
      markReady()
      handleAuthQuery()
    }
  })()

  return initPromise
}

export async function retryInit(): Promise<void> {
  initPromise = null
  authError.value = ''
  ready.value = false
  await initAuth()
}

export function openLogin(reason = '') {
  loginReason.value = reason
  loginTab.value = 'github'
  dialogOpen.value = true
}

export function closeLogin() {
  dialogOpen.value = false
  loginReason.value = ''
}

export function finishLogin(next: AuthUser, message = '登录成功，现在可以评论了。') {
  setUser(next)
  ready.value = true
  markReady()
  closeLogin()
  notice.value = message
}

export function clearNotice() {
  notice.value = ''
}

export async function logout() {
  try {
    await apiLogout()
  } finally {
    setUser(null)
    notice.value = '已退出登录。'
  }
}

export async function changeNick(nick: string): Promise<AuthUser> {
  const next = await updateNickname(nick)
  setUser(next)
  return next
}

export function useAuth() {
  return {
    user: computed(() => user.value),
    ready: computed(() => ready.value),
    dialogOpen: computed(() => dialogOpen.value),
    loginTab,
    loginReason: computed(() => loginReason.value),
    notice: computed(() => notice.value),
    authError: computed(() => authError.value),
    openLogin,
    closeLogin,
    finishLogin,
    logout,
    changeNick,
    retryInit,
    clearNotice,
  }
}
