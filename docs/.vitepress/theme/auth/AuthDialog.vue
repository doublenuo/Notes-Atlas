<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AuthApiError, GITHUB_LOGIN_URL, sendEmailCode, verifyEmailCode } from './client'
import { useAuth } from './useAuth'

const { dialogOpen, loginTab, loginReason, authError, finishLogin, closeLogin } = useAuth()

const email = ref('')
const code = ref('')
const codeSent = ref(false)
const sending = ref(false)
const verifying = ref(false)
const formError = ref('')
const formMessage = ref('')
const cooldown = ref(0)
const panel = ref<HTMLElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

function clearTimers() {
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = undefined
}

function startCooldown(seconds: number) {
  clearTimers()
  cooldown.value = Math.max(0, Math.ceil(seconds))
  if (cooldown.value <= 0) return
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, cooldown.value - 1)
    if (cooldown.value === 0) clearTimers()
  }, 1000)
}

function resetForm() {
  formError.value = ''
  formMessage.value = ''
  code.value = ''
  codeSent.value = false
  email.value = ''
  cooldown.value = 0
  clearTimers()
}

function switchTab(tab: 'github' | 'email') {
  loginTab.value = tab
  formError.value = ''
  formMessage.value = ''
}

function close() {
  closeLogin()
}

function onKeydown(event: KeyboardEvent) {
  if (!dialogOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

async function sendCode() {
  if (sending.value || cooldown.value > 0) return
  const address = email.value.trim().toLowerCase()
  if (!emailValid.value) {
    formError.value = '请输入有效的邮箱地址'
    emailInput.value?.focus()
    return
  }

  sending.value = true
  formError.value = ''
  formMessage.value = ''
  try {
    const result = await sendEmailCode(address)
    email.value = address
    codeSent.value = true
    formMessage.value = '验证码已发送'
    startCooldown(result.retryAfter ?? 60)
    await nextTick()
    panel.value?.querySelector<HTMLInputElement>('input[inputmode="numeric"]')?.focus()
  } catch (error) {
    if (error instanceof AuthApiError) {
      formError.value = error.message
      if (error.status === 429) startCooldown(error.retryAfter ?? 60)
    } else {
      formError.value = '验证码发送失败，请稍后重试'
    }
  } finally {
    sending.value = false
  }
}

function changeEmail() {
  codeSent.value = false
  code.value = ''
  cooldown.value = 0
  clearTimers()
  void nextTick(() => emailInput.value?.focus())
}

async function submitEmail() {
  if (verifying.value) return
  if (!codeSent.value) {
    await sendCode()
    return
  }

  const address = email.value.trim().toLowerCase()
  const value = code.value.trim()
  if (!/^\d{6}$/.test(value)) {
    formError.value = '请输入 6 位数字验证码'
    return
  }

  verifying.value = true
  formError.value = ''
  try {
    const next = await verifyEmailCode(address, value)
    finishLogin(next)
  } catch (error) {
    formError.value = error instanceof AuthApiError ? error.message : '登录失败，请稍后重试'
  } finally {
    verifying.value = false
  }
}

function loginWithGithub() {
  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.assign(GITHUB_LOGIN_URL(redirect))
}

watch(dialogOpen, async (open) => {
  if (!open) {
    clearTimers()
    document.documentElement.classList.remove('weno-auth-dialog-open')
    return
  }
  resetForm()
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('weno-auth-dialog-open')
  }
  await nextTick()
  emailInput.value?.focus()
})

watch(loginTab, () => {
  formError.value = ''
  formMessage.value = ''
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  clearTimers()
  document.removeEventListener('keydown', onKeydown)
  document.documentElement.classList.remove('weno-auth-dialog-open')
})
</script>

<template>
  <Teleport to="body">
    <div
        v-if="dialogOpen"
        class="weno-auth-modal"
        role="presentation"
        @click.self="close"
      >
        <section
          ref="panel"
          class="weno-auth-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weno-auth-title"
        >
          <button class="weno-auth-close" type="button" aria-label="关闭登录窗口" @click="close">
            <span aria-hidden="true">×</span>
          </button>

          <header class="weno-auth-head">
            <div class="weno-auth-brand" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12 2.8l1.9 5.3 5.3 1.9-5.3 1.9L12 17.2l-1.9-5.3L4.8 10l5.3-1.9L12 2.8Z"
                  fill="currentColor"
                />
                <path
                  d="M18.8 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"
                  fill="currentColor"
                  opacity="0.65"
                />
              </svg>
            </div>
            <h2 id="weno-auth-title">登录</h2>
            <p class="weno-auth-subtitle">{{ loginReason || '一次登录，全站通用' }}</p>
          </header>

          <p v-if="authError" class="weno-auth-alert" role="alert">{{ authError }}</p>

          <div class="weno-auth-tabs" role="tablist" aria-label="登录方式">
            <button
              type="button"
              role="tab"
              :aria-selected="loginTab === 'github'"
              :class="{ 'is-active': loginTab === 'github' }"
              @click="switchTab('github')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                />
              </svg>
              GitHub
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="loginTab === 'email'"
              :class="{ 'is-active': loginTab === 'email' }"
              @click="switchTab('email')"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7" />
                <path
                  d="m4 7 8 6 8-6"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              邮箱
            </button>
          </div>

          <div v-if="loginTab === 'github'" class="weno-auth-pane" role="tabpanel">
            <button class="weno-auth-github" type="button" @click="loginWithGithub">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"
                />
              </svg>
              使用 GitHub 登录
            </button>
          </div>

          <form v-else class="weno-auth-pane" role="tabpanel" @submit.prevent="submitEmail">
            <label class="weno-auth-field">
              <span class="weno-auth-sr-only">邮箱地址</span>
              <input
                ref="emailInput"
                v-model="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="邮箱地址"
                aria-label="邮箱地址"
                :disabled="codeSent"
                @input="formError = ''"
              />
            </label>

            <div v-if="codeSent" class="weno-auth-code-row">
              <label class="weno-auth-field">
                <span class="weno-auth-sr-only">6 位验证码</span>
                <input
                  v-model="code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="6"
                  placeholder="6 位验证码"
                  aria-label="6 位验证码"
                  @input="formError = ''"
                />
              </label>
              <button
                class="weno-auth-resend"
                type="button"
                :disabled="cooldown > 0 || sending"
                @click="sendCode"
              >
                {{ cooldown > 0 ? `${cooldown}s` : '重发' }}
              </button>
            </div>

            <p v-if="formMessage" class="weno-auth-success" role="status">{{ formMessage }}</p>
            <p v-if="formError" class="weno-auth-alert" role="alert">{{ formError }}</p>

            <button class="weno-auth-submit" type="submit" :disabled="sending || verifying">
              {{ verifying ? '登录中…' : codeSent ? '登录' : sending ? '发送中…' : '继续' }}
            </button>
            <button
              v-if="codeSent"
              class="weno-auth-change-email"
              type="button"
              @click="changeEmail"
            >
              换个邮箱
            </button>
          </form>

          <p class="weno-auth-privacy">邮箱仅用于身份验证</p>
        </section>
    </div>
  </Teleport>
</template>
