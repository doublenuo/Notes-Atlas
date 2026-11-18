<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { AuthApiError } from '../auth/client'
import { useAuth } from '../auth/useAuth'

const { user, ready, authError, openLogin, logout, changeNick, retryInit } = useAuth()

const avatarFailed = ref(false)
const editing = ref(false)
const nickDraft = ref('')
const saving = ref(false)
const saveError = ref('')
const savedMessage = ref('')
const confirmingLogout = ref(false)
const loggingOut = ref(false)
const retrying = ref(false)
const nickInput = ref<HTMLInputElement | null>(null)
let savedTimer: ReturnType<typeof setTimeout> | undefined

const initials = computed(() => (user.value?.nick || '?').trim().slice(0, 1).toUpperCase())
const avatar = computed(() => (avatarFailed.value ? '' : user.value?.avatarUrl || ''))
const joinedAt = computed(() => {
  const seconds = user.value?.createdAt
  if (!seconds) return '—'
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
})

function clearSavedTimer() {
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = undefined
}

function flashSaved(message: string) {
  savedMessage.value = message
  clearSavedTimer()
  savedTimer = setTimeout(() => {
    savedMessage.value = ''
  }, 4000)
}

function resetTransientState() {
  editing.value = false
  confirmingLogout.value = false
  saving.value = false
  loggingOut.value = false
  saveError.value = ''
  clearSavedTimer()
  savedMessage.value = ''
}

watch(
  () => user.value?.avatarUrl,
  () => {
    avatarFailed.value = false
  },
)

watch(
  () => user.value?.id,
  () => {
    resetTransientState()
    avatarFailed.value = false
  },
)

function startEdit() {
  nickDraft.value = user.value?.nick || ''
  saveError.value = ''
  editing.value = true
  void nextTick(() => {
    nickInput.value?.focus()
    nickInput.value?.select()
  })
}

function cancelEdit() {
  editing.value = false
  saveError.value = ''
  nickDraft.value = ''
}

async function saveNick() {
  if (saving.value) return
  const value = nickDraft.value.trim()
  if (!value) {
    saveError.value = '昵称不能为空'
    return
  }
  if (Array.from(value).length > 20) {
    saveError.value = '昵称最多 20 个字符'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    await changeNick(value)
    editing.value = false
    flashSaved('已保存')
  } catch (error) {
    saveError.value = error instanceof AuthApiError ? error.message : '昵称保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function requestLogin() {
  openLogin('登录后查看个人中心')
}

async function retryAuth() {
  if (retrying.value) return
  retrying.value = true
  try {
    await retryInit()
  } finally {
    retrying.value = false
  }
}

async function confirmLogout() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await logout()
  } catch {
    // useAuth 的 logout 即使请求失败也会清理本地登录态，界面此时已切回未登录视图
  } finally {
    loggingOut.value = false
    confirmingLogout.value = false
  }
}

onBeforeUnmount(clearSavedTimer)
</script>

<template>
  <div class="profile-page" data-pagefind-ignore>
    <div class="profile-shell">
      <header class="profile-hero">
        <span class="profile-hero__mark" aria-hidden="true" />
        <h1>个人中心</h1>
      </header>

      <div v-if="!ready" class="profile-card profile-skeleton" aria-live="polite">
        <span class="profile-sr-only">正在读取登录状态…</span>
        <div class="profile-skeleton__avatar" aria-hidden="true" />
        <div class="profile-skeleton__lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>

      <section v-else-if="!user" class="profile-card profile-guest">
        <span class="profile-guest__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
            <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke-linecap="round" />
            <circle cx="12" cy="15.2" r="1.35" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h2>登录后查看个人中心</h2>

        <p v-if="authError" class="profile-alert" role="alert">{{ authError }}</p>

        <div class="profile-guest__actions">
          <button class="profile-btn profile-btn--primary" type="button" @click="requestLogin">
            登录账号
          </button>
          <button
            v-if="authError"
            class="profile-btn"
            type="button"
            :disabled="retrying"
            @click="retryAuth"
          >
            {{ retrying ? '正在重试…' : '重新读取登录状态' }}
          </button>
        </div>
      </section>

      <section v-else class="profile-card">
        <header class="profile-identity">
          <img
            v-if="avatar"
            class="profile-avatar"
            :src="avatar"
            alt=""
            referrerpolicy="no-referrer"
            @error="avatarFailed = true"
          />
          <span v-else class="profile-avatar profile-avatar--fallback" aria-hidden="true">
            {{ initials }}
          </span>

          <div class="profile-identity__main">
            <div class="profile-name-row">
              <template v-if="!editing">
                <h2>
                  {{ user.nick }}
                  <span v-if="user.isAdmin" class="profile-badge">管理员</span>
                </h2>
                <button
                  class="profile-edit"
                  type="button"
                  aria-label="修改昵称"
                  @click="startEdit"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke-linejoin="round" />
                    <path d="m13.5 6.5 4 4" stroke-linecap="round" />
                  </svg>
                  修改
                </button>
                <span v-if="savedMessage" class="profile-saved" role="status">{{ savedMessage }}</span>
              </template>

              <form v-else class="profile-nick-form" @submit.prevent="saveNick">
                <label class="profile-sr-only" for="profile-nick-input">新昵称</label>
                <input
                  id="profile-nick-input"
                  ref="nickInput"
                  v-model="nickDraft"
                  class="profile-input"
                  type="text"
                  maxlength="20"
                  autocomplete="nickname"
                  placeholder="昵称"
                  @input="saveError = ''"
                />
                <div class="profile-form-actions">
                  <button class="profile-btn" type="button" :disabled="saving" @click="cancelEdit">
                    取消
                  </button>
                  <button
                    class="profile-btn profile-btn--primary"
                    type="submit"
                    :disabled="saving"
                  >
                    {{ saving ? '保存中…' : '保存' }}
                  </button>
                </div>
              </form>
            </div>

            <p v-if="saveError" class="profile-alert" role="alert">{{ saveError }}</p>
            <p class="profile-identity__email" :title="user.email">{{ user.email }}</p>
            <p class="profile-identity__meta">
              <span class="profile-verified" aria-label="邮箱已验证">✓ 已验证</span>
            </p>
          </div>
        </header>

        <footer class="profile-footer">
          <span class="profile-joined">加入于 {{ joinedAt }}</span>

          <button
            v-if="!confirmingLogout"
            class="profile-logout"
            type="button"
            @click="confirmingLogout = true"
          >
            退出登录
          </button>

          <div v-else class="profile-logout-confirm" role="group" aria-label="确认退出登录">
            <span>确认退出？</span>
            <button
              class="profile-logout"
              type="button"
              :disabled="loggingOut"
              @click="confirmingLogout = false"
            >
              取消
            </button>
            <button
              class="profile-logout profile-logout--danger"
              type="button"
              :disabled="loggingOut"
              @click="confirmLogout"
            >
              {{ loggingOut ? '退出中…' : '退出' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  position: relative;
  overflow: hidden;
  padding: 8px 0 72px;
  background:
    radial-gradient(680px 340px at 12% -4%, rgba(124, 92, 252, 0.08), transparent 72%),
    radial-gradient(560px 300px at 92% 8%, rgba(56, 189, 248, 0.06), transparent 70%);
}

.profile-page::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  background-image: radial-gradient(rgba(124, 92, 252, 0.16) 0.8px, transparent 0.8px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.28) 54%, transparent 92%);
  pointer-events: none;
  content: '';
}

.profile-shell {
  position: relative;
  z-index: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px;
}

.profile-hero {
  padding: 22px 2px 26px;
}

.profile-hero__mark {
  display: block;
  width: 30px;
  height: 4px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--vp-c-brand-1),
    color-mix(in srgb, var(--vp-c-brand-1) 25%, transparent)
  );
}

.profile-hero h1 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(2rem, 4vw, 2.5rem);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.15;
}

.profile-card {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 22px;
  padding: 26px 28px 20px;
  background: var(--vp-c-bg);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 20px 60px rgba(15, 23, 42, 0.08);
}

.profile-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

/* 加载骨架 */
.profile-skeleton {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 138px;
}

.profile-skeleton__avatar {
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  border-radius: 50%;
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.12));
  animation: profile-pulse 1.4s ease-in-out infinite;
}

.profile-skeleton__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 11px;
}

.profile-skeleton__lines span {
  height: 12px;
  border-radius: 999px;
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.12));
  animation: profile-pulse 1.4s ease-in-out infinite;
}

.profile-skeleton__lines span:nth-child(1) {
  width: 34%;
}

.profile-skeleton__lines span:nth-child(2) {
  width: 58%;
}

.profile-skeleton__lines span:nth-child(3) {
  width: 42%;
}

/* 未登录引导 */
.profile-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 46px 28px;
  text-align: center;
}

.profile-guest__icon {
  display: inline-flex;
  width: 54px;
  height: 54px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 22%, var(--vp-c-divider));
  border-radius: 17px;
  background: var(--vp-c-brand-soft, rgba(52, 81, 178, 0.08));
  color: var(--vp-c-brand-1);
}

.profile-guest__icon svg {
  width: 26px;
  height: 26px;
}

.profile-guest h2 {
  margin: 18px 0 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.profile-guest__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
}

.profile-alert {
  max-width: 420px;
  margin: 12px 0 0;
  border: 1px solid color-mix(in srgb, var(--vp-c-danger-1, #d33) 26%, transparent);
  border-radius: 9px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--vp-c-danger-1, #d33) 7%, transparent);
  color: var(--vp-c-danger-1, #d33);
  font-size: 12.5px;
  line-height: 1.6;
  text-align: left;
}

/* 已登录身份区 */
.profile-identity {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 20px;
}

.profile-avatar {
  width: 76px;
  height: 76px;
  flex: 0 0 76px;
  border: 3px solid var(--vp-c-bg);
  border-radius: 50%;
  background: var(--vp-c-brand-soft, rgba(52, 81, 178, 0.14));
  object-fit: cover;
  box-shadow: 0 0 0 1px var(--vp-c-divider), 0 12px 30px rgba(15, 23, 42, 0.12);
}

.profile-avatar--fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-brand-1);
  font-size: 30px;
  font-weight: 700;
}

.profile-identity__main {
  min-width: 0;
  flex: 1;
}

.profile-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.profile-identity h2 {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 1.45rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 26%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
  background: var(--vp-c-brand-soft, rgba(52, 81, 178, 0.1));
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
}

.profile-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 7px;
  padding: 3px 6px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.profile-edit svg {
  width: 13px;
  height: 13px;
}

.profile-edit:hover {
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.1));
  color: var(--vp-c-brand-1);
}

.profile-saved {
  color: var(--vp-c-success-1, #2f9e44);
  font-size: 12px;
  font-weight: 600;
}

.profile-identity__email {
  overflow: hidden;
  margin: 8px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-identity__meta {
  margin: 6px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.profile-verified {
  color: var(--vp-c-success-1, #2f9e44);
  font-weight: 600;
}

/* 昵称编辑 */
.profile-nick-form {
  width: 100%;
  max-width: 420px;
}

.profile-input {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  padding: 8px 11px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.profile-input:focus {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft, rgba(52, 81, 178, 0.12));
}

.profile-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.profile-form-actions .profile-btn {
  padding: 6px 12px;
  font-size: 12px;
}

/* 底部操作 */
.profile-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  border-top: 1px solid var(--vp-c-divider);
  margin-top: 20px;
  padding-top: 14px;
}

.profile-joined {
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.profile-logout {
  border: 0;
  border-radius: 7px;
  padding: 4px 7px;
  background: transparent;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
}

.profile-logout:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vp-c-danger-1, #d33) 7%, transparent);
  color: var(--vp-c-danger-1, #d33);
}

.profile-logout--danger {
  color: var(--vp-c-danger-1, #d33);
  font-weight: 600;
}

.profile-logout:disabled {
  opacity: 0.55;
  cursor: default;
}

.profile-logout-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

/* 按钮 */
.profile-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  padding: 8px 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}

.profile-btn:hover:not(:disabled) {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.profile-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.profile-btn--primary {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
}

.profile-btn--primary:hover:not(:disabled) {
  border-color: var(--vp-c-brand-2, var(--vp-c-brand-1));
  background: var(--vp-c-brand-2, var(--vp-c-brand-1));
  color: #fff;
}

@keyframes profile-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

@media (max-width: 768px) {
  .profile-page {
    padding-bottom: 48px;
  }

  .profile-shell {
    padding: 0 16px;
  }

  .profile-hero {
    padding: 14px 2px 20px;
  }

  .profile-card {
    border-radius: 18px;
    padding: 20px;
  }

  .profile-skeleton {
    gap: 14px;
    min-height: 118px;
  }

  .profile-skeleton__avatar {
    width: 62px;
    height: 62px;
    flex-basis: 62px;
  }

  .profile-identity {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .profile-avatar {
    width: 64px;
    height: 64px;
    flex-basis: 64px;
  }

  .profile-avatar--fallback {
    font-size: 24px;
  }

  .profile-identity h2 {
    font-size: 1.25rem;
  }

  .profile-identity__email {
    overflow-wrap: anywhere;
    text-overflow: clip;
    white-space: normal;
  }

  .profile-nick-form {
    max-width: none;
  }

  .profile-form-actions {
    justify-content: flex-start;
  }

  .profile-guest {
    padding: 38px 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-skeleton__avatar,
  .profile-skeleton__lines span {
    animation: none;
  }

  .profile-btn,
  .profile-input,
  .profile-edit,
  .profile-logout {
    transition: none;
  }
}
</style>
