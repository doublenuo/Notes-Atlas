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
    flashSaved('昵称已更新')
  } catch (error) {
    saveError.value = error instanceof AuthApiError ? error.message : '昵称保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function requestLogin() {
  openLogin('登录后即可查看个人中心')
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
        <p class="profile-eyebrow">ACCOUNT · 个人中心</p>
        <h1>个人中心</h1>
        <p class="profile-hero__desc">查看账号资料、修改昵称，以及管理当前登录状态。</p>
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
        <p class="profile-guest__desc">个人中心只对已登录用户开放。登录后可以查看账号资料、修改昵称和管理登录状态。</p>

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

      <div v-else class="profile-stack">
        <section class="profile-card">
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
              <h2>
                {{ user.nick }}
                <span v-if="user.isAdmin" class="profile-badge">管理员</span>
              </h2>
              <p class="profile-identity__email">{{ user.email }}</p>
              <p class="profile-identity__meta">
                <span class="profile-verified" aria-label="邮箱已验证">✓ 邮箱已验证</span>
                <span aria-hidden="true">·</span>
                <span>加入于 {{ joinedAt }}</span>
              </p>
            </div>
          </header>

          <div class="profile-grid">
            <section class="profile-block" aria-labelledby="profile-nick-title">
              <div class="profile-block__head">
                <div>
                  <h3 id="profile-nick-title">昵称</h3>
                  <p>昵称会显示在导航栏和评论中，最多 20 个字符。</p>
                </div>
                <button
                  v-if="!editing"
                  class="profile-btn profile-btn--small"
                  type="button"
                  @click="startEdit"
                >
                  修改昵称
                </button>
              </div>

              <form v-if="editing" class="profile-nick-form" @submit.prevent="saveNick">
                <label class="profile-sr-only" for="profile-nick-input">新昵称</label>
                <input
                  id="profile-nick-input"
                  ref="nickInput"
                  v-model="nickDraft"
                  class="profile-input"
                  type="text"
                  maxlength="20"
                  autocomplete="nickname"
                  placeholder="输入新的昵称"
                  @input="saveError = ''"
                />
                <p v-if="saveError" class="profile-alert" role="alert">{{ saveError }}</p>
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

              <p v-else class="profile-current">
                <span>{{ user.nick }}</span>
              </p>

              <p v-if="savedMessage" class="profile-success" role="status">{{ savedMessage }}</p>
            </section>

            <section class="profile-block" aria-labelledby="profile-account-title">
              <h3 id="profile-account-title">账号信息</h3>
              <dl class="profile-meta">
                <div>
                  <dt>邮箱</dt>
                  <dd>{{ user.email }}</dd>
                </div>
                <div>
                  <dt>注册时间</dt>
                  <dd>{{ joinedAt }}</dd>
                </div>
                <div>
                  <dt>账号编号</dt>
                  <dd>#{{ user.id }}</dd>
                </div>
                <div>
                  <dt>身份</dt>
                  <dd>{{ user.isAdmin ? '管理员' : '普通用户' }}</dd>
                </div>
              </dl>
            </section>
          </div>
        </section>

        <section class="profile-card profile-session">
          <div class="profile-session__text">
            <h3>登录状态</h3>
            <p>当前设备已登录。退出后需要重新登录，才能继续评论和访问个人中心。</p>
          </div>

          <div v-if="!confirmingLogout" class="profile-session__actions">
            <button class="profile-btn profile-btn--danger" type="button" @click="confirmingLogout = true">
              退出登录
            </button>
          </div>

          <div v-else class="profile-session__confirm" role="group" aria-label="确认退出登录">
            <span>确认退出？</span>
            <button
              class="profile-btn"
              type="button"
              :disabled="loggingOut"
              @click="confirmingLogout = false"
            >
              取消
            </button>
            <button
              class="profile-btn profile-btn--danger"
              type="button"
              :disabled="loggingOut"
              @click="confirmLogout"
            >
              {{ loggingOut ? '退出中…' : '确认退出' }}
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  position: relative;
  overflow: hidden;
  padding: 8px 0 72px;
  background:
    radial-gradient(760px 380px at 12% -4%, rgba(124, 92, 252, 0.08), transparent 72%),
    radial-gradient(620px 320px at 92% 8%, rgba(56, 189, 248, 0.06), transparent 70%);
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
  max-width: 920px;
  margin: 0 auto;
  padding: 0 24px;
}

.profile-hero {
  padding: 20px 2px 30px;
}

.profile-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
}

.profile-hero h1 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.15;
}

.profile-hero__desc {
  max-width: 620px;
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 15px;
  line-height: 1.85;
}

.profile-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  padding: 28px;
  background: var(--vp-c-bg);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 20px 60px rgba(15, 23, 42, 0.08);
}

.profile-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
  gap: 20px;
  min-height: 150px;
}

.profile-skeleton__avatar {
  width: 84px;
  height: 84px;
  flex: 0 0 84px;
  border-radius: 50%;
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.12));
  animation: profile-pulse 1.4s ease-in-out infinite;
}

.profile-skeleton__lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.profile-skeleton__lines span {
  height: 12px;
  border-radius: 999px;
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.12));
  animation: profile-pulse 1.4s ease-in-out infinite;
}

.profile-skeleton__lines span:nth-child(1) {
  width: 38%;
}

.profile-skeleton__lines span:nth-child(2) {
  width: 62%;
}

.profile-skeleton__lines span:nth-child(3) {
  width: 48%;
}

/* 未登录引导 */
.profile-guest {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52px 32px;
  text-align: center;
}

.profile-guest__icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 22%, var(--vp-c-divider));
  border-radius: 18px;
  background: var(--vp-c-brand-soft, rgba(52, 81, 178, 0.08));
  color: var(--vp-c-brand-1);
}

.profile-guest__icon svg {
  width: 28px;
  height: 28px;
}

.profile-guest h2 {
  margin: 20px 0 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.profile-guest__desc {
  max-width: 430px;
  margin: 10px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.8;
}

.profile-guest__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
}

.profile-alert {
  max-width: 460px;
  margin: 16px 0 0;
  border: 1px solid color-mix(in srgb, var(--vp-c-danger-1, #d33) 26%, transparent);
  border-radius: 10px;
  padding: 9px 12px;
  background: color-mix(in srgb, var(--vp-c-danger-1, #d33) 7%, transparent);
  color: var(--vp-c-danger-1, #d33);
  font-size: 13px;
  line-height: 1.6;
  text-align: left;
}

/* 已登录身份区 */
.profile-identity {
  display: flex;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 24px;
}

.profile-avatar {
  width: 84px;
  height: 84px;
  flex: 0 0 84px;
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
  font-size: 32px;
  font-weight: 700;
}

.profile-identity__main {
  min-width: 0;
}

.profile-identity h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 1.5rem;
  font-weight: 750;
  letter-spacing: -0.03em;
  line-height: 1.25;
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

.profile-identity__email {
  overflow: hidden;
  margin: 7px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-identity__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 7px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.profile-verified {
  color: var(--vp-c-success-1, #2f9e44);
  font-weight: 600;
}

/* 资料区 */
.profile-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px;
  padding-top: 24px;
}

.profile-block h3 {
  margin: 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 700;
}

.profile-block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.profile-block p {
  margin: 8px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.profile-current {
  display: flex;
  align-items: center;
  min-height: 38px;
  margin-top: 14px !important;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1) !important;
  font-size: 13.5px !important;
  font-weight: 600;
}

.profile-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 0;
}

.profile-meta > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px dashed var(--vp-c-divider);
  padding-bottom: 9px;
}

.profile-meta > div:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.profile-meta dt {
  flex: 0 0 auto;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.profile-meta dd {
  overflow: hidden;
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 表单 */
.profile-nick-form {
  margin-top: 14px;
}

.profile-input {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 9px 12px;
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
  margin-top: 12px;
}

.profile-success {
  margin: 10px 0 0 !important;
  color: var(--vp-c-success-1, #2f9e44) !important;
  font-size: 12.5px !important;
}

/* 按钮 */
.profile-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  padding: 8px 15px;
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

.profile-btn--small {
  flex: 0 0 auto;
  padding: 6px 11px;
  font-size: 12px;
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

.profile-btn--danger {
  border-color: color-mix(in srgb, var(--vp-c-danger-1, #d33) 34%, var(--vp-c-divider));
  color: var(--vp-c-danger-1, #d33);
}

.profile-btn--danger:hover:not(:disabled) {
  border-color: var(--vp-c-danger-1, #d33);
  background: color-mix(in srgb, var(--vp-c-danger-1, #d33) 7%, transparent);
  color: var(--vp-c-danger-1, #d33);
}

/* 登录状态 */
.profile-session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 28px;
}

.profile-session h3 {
  margin: 0;
  border: 0;
  padding: 0;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 700;
}

.profile-session p {
  max-width: 520px;
  margin: 7px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.profile-session__actions {
  flex: 0 0 auto;
}

.profile-session__confirm {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
  font-size: 12.5px;
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
    padding: 14px 2px 22px;
  }

  .profile-card {
    border-radius: 18px;
    padding: 20px;
  }

  .profile-identity {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .profile-avatar {
    width: 68px;
    height: 68px;
    flex-basis: 68px;
  }

  .profile-avatar--fallback {
    font-size: 26px;
  }

  .profile-identity h2 {
    font-size: 1.3rem;
  }

  .profile-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }

  .profile-guest {
    padding: 40px 20px;
  }

  .profile-session {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
  }

  .profile-session__confirm {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-skeleton__avatar,
  .profile-skeleton__lines span {
    animation: none;
  }

  .profile-btn,
  .profile-input {
    transition: none;
  }
}
</style>
