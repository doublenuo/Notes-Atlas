<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useData, withBase } from 'vitepress'

interface RiskFrontmatter {
  logo?: string
  name?: string
  desc?: string
  linkIllegal?: string
}

const { frontmatter } = useData()
const fm = computed(() => frontmatter.value as RiskFrontmatter)
const siteName = computed(() => fm.value.name || "Weno's Blog")
const siteDesc = computed(
  () => fm.value.desc || '你即将离开本站，请确认目标地址可信，注意财产安全。',
)
const invalidText = computed(
  () => fm.value.linkIllegal || '目标地址缺失或格式不正确，已阻止跳转。',
)
const siteLogo = computed(() => (fm.value.logo ? withBase(fm.value.logo) : ''))
const homeUrl = withBase('/')

const logoError = ref(false)
const ready = ref(false)
const targetUrl = ref('')
const targetHost = ref('')
const targetProtocol = ref('')
const copyState = ref<'idle' | 'copied' | 'failed'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined

const isHttp = computed(() => targetProtocol.value === 'http:')
const protocolLabel = computed(() => (isHttp.value ? 'HTTP' : 'HTTPS'))
const copyLabel = computed(() => {
  if (copyState.value === 'copied') return '已复制'
  if (copyState.value === 'failed') return '复制失败'
  return '复制'
})

const parseTarget = (raw: string): URL | null => {
  if (!/^https?:\/\//i.test(raw)) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const raw = (params.get('target') || '').trim()
  const target = parseTarget(raw)
  if (target) {
    targetUrl.value = target.href
    targetHost.value = target.hostname
    targetProtocol.value = target.protocol
  }
  ready.value = true
})

onBeforeUnmount(() => {
  if (copyTimer) clearTimeout(copyTimer)
})

const copyTarget = async () => {
  if (!targetUrl.value) return
  try {
    if (!navigator.clipboard) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(targetUrl.value)
    copyState.value = 'copied'
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = targetUrl.value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      copyState.value = document.execCommand('copy') ? 'copied' : 'failed'
    } catch {
      copyState.value = 'failed'
    }
    document.body.removeChild(textarea)
  }
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyState.value = 'idle'
  }, 1600)
}

const continueToTarget = () => {
  if (targetUrl.value) window.location.assign(targetUrl.value)
}

const fallbackBack = () => {
  if (window.history.length > 1) window.history.back()
  else window.location.assign(homeUrl)
}

const goBack = () => {
  // 从文章里 window.open 打开时，优先关闭这个中转标签页。
  if (window.opener) {
    try {
      window.opener.focus()
      window.close()
    } catch {
      // 浏览器可能拒绝脚本关闭窗口，退回站内上一页。
    }
    window.setTimeout(() => {
      if (!window.closed) fallbackBack()
    }, 80)
    return
  }
  fallbackBack()
}

const goHome = () => {
  window.location.assign(homeUrl)
}
</script>

<template>
  <div class="risk-page">
    <div class="risk-page__grid" aria-hidden="true"></div>

    <main class="risk-card" :class="{ 'risk-card--checking': !ready }">
      <header class="risk-brand">
        <div class="risk-brand__identity">
          <span class="risk-brand__logo">
            <img
              v-if="siteLogo && !logoError"
              :src="siteLogo"
              :alt="siteName"
              @error="logoError = true"
            />
            <span v-else class="risk-brand__initial">{{ siteName.slice(0, 1) }}</span>
          </span>
          <span class="risk-brand__name">{{ siteName }}</span>
        </div>
        <span class="risk-brand__badge">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3.25 19 6v5.25c0 4.4-2.86 7.83-7 9.75-4.14-1.92-7-5.35-7-9.75V6l7-2.75Z"
              fill="none"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.7"
            />
            <path
              d="m8.9 12 2 2 4.2-4.2"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.7"
            />
          </svg>
          安全提醒
        </span>
      </header>

      <div v-if="!ready" class="risk-checking" role="status" aria-live="polite">
        <span class="risk-spinner" aria-hidden="true"></span>
        <p class="risk-eyebrow">CHECKING LINK · 正在确认</p>
        <h1>正在确认链接</h1>
        <p class="risk-desc">正在检查目标地址，请稍候…</p>
      </div>

      <section v-else-if="targetUrl" class="risk-content">
        <div class="risk-icon risk-icon--safe" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M12 3.25 19 6v5.25c0 4.4-2.86 7.83-7 9.75-4.14-1.92-7-5.35-7-9.75V6l7-2.75Z"
              fill="none"
              stroke="currentColor"
              stroke-linejoin="round"
              stroke-width="1.7"
            />
            <path
              d="M12 8.25v4.5m0 3.1v.15"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.9"
            />
          </svg>
        </div>

        <p class="risk-eyebrow">EXTERNAL LINK · 外链提醒</p>
        <h1>即将离开本站</h1>
        <p class="risk-desc">{{ siteDesc }}</p>

        <div class="risk-target" :class="{ 'risk-target--http': isHttp }">
          <div class="risk-target__head">
            <span>目标地址</span>
            <span class="risk-protocol" :class="{ 'risk-protocol--http': isHttp }">
              {{ protocolLabel }}
            </span>
          </div>
          <strong class="risk-target__host">{{ targetHost }}</strong>
          <div class="risk-target__url">
            <code>{{ targetUrl }}</code>
            <button
              type="button"
              class="risk-copy"
              :class="{ 'is-copied': copyState === 'copied' }"
              :aria-label="copyState === 'copied' ? '链接已复制' : '复制目标链接'"
              @click="copyTarget"
            >
              {{ copyLabel }}
            </button>
          </div>
        </div>

        <ul class="risk-tips">
          <li>不要在不熟悉的页面输入账号、密码或支付信息。</li>
          <li>确认链接来源可信，谨防钓鱼与仿冒站点。</li>
          <li>如需返回，本站内容仍在原标签页。</li>
        </ul>

        <div class="risk-actions">
          <button type="button" class="risk-btn risk-btn--primary" @click="continueToTarget">
            <span>继续访问</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h14m-5-5 5 5-5 5"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>
          <button type="button" class="risk-btn risk-btn--ghost" @click="goBack">
            返回上一页
          </button>
        </div>

        <p class="risk-foot">继续访问即表示你已确认该链接安全，本站不对站外内容负责。</p>
      </section>

      <section v-else class="risk-content risk-content--invalid" role="alert">
        <div class="risk-icon risk-icon--invalid" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7" />
            <path
              d="M12 7.8v5.1m0 3.1v.15"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.9"
            />
          </svg>
        </div>

        <p class="risk-eyebrow">LINK UNVERIFIED · 链接异常</p>
        <h1>这个链接无法确认</h1>
        <p class="risk-desc">{{ invalidText }}</p>

        <div class="risk-actions">
          <button type="button" class="risk-btn risk-btn--primary" @click="goHome">
            <span>返回首页</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h14m-5-5 5 5-5 5"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </button>
          <button type="button" class="risk-btn risk-btn--ghost" @click="goBack">
            返回上一页
          </button>
        </div>

        <p class="risk-foot">为安全起见，本站已阻止跳转到这个地址。</p>
      </section>
    </main>

    <p class="risk-page__footer">{{ siteName }} · 外链安全提醒</p>
  </div>
</template>

<style scoped>
.risk-page {
  --rl-radius: 26px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 56px 24px 32px;
  overflow: hidden;
  background:
    radial-gradient(880px 440px at 50% -12%, rgba(124, 92, 252, 0.13), transparent 72%),
    radial-gradient(620px 380px at 100% 108%, rgba(56, 189, 248, 0.08), transparent 72%),
    var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.risk-page__grid {
  position: absolute;
  z-index: 0;
  inset: 0;
  background-image: radial-gradient(rgba(124, 92, 252, 0.16) 0.8px, transparent 0.8px);
  background-size: 23px 23px;
  mask-image: radial-gradient(ellipse at 50% 45%, #000 0%, rgba(0, 0, 0, 0.28) 52%, transparent 76%);
  pointer-events: none;
}

.risk-card {
  position: relative;
  z-index: 1;
  width: min(710px, 100%);
  padding: 28px 34px 30px;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--rl-radius);
  background: var(--vp-c-bg-soft);
  box-shadow:
    0 26px 80px rgba(20, 20, 40, 0.1),
    0 2px 8px rgba(20, 20, 40, 0.04);
  animation: risk-card-in 0.42s ease both;
}

.risk-card--checking {
  min-height: 250px;
}

.risk-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.risk-brand__identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.risk-brand__logo {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
}

.risk-brand__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.risk-brand__initial {
  color: var(--vp-c-brand-1);
  font-size: 15px;
  font-weight: 750;
}

.risk-brand__name {
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-brand__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid rgba(124, 92, 252, 0.16);
  border-radius: 999px;
  background: rgba(124, 92, 252, 0.08);
  color: var(--vp-c-brand-1);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.risk-brand__badge svg {
  width: 13px;
  height: 13px;
}

.risk-content,
.risk-checking {
  padding-top: 26px;
  text-align: center;
}

.risk-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  margin-bottom: 16px;
  border: 1px solid rgba(124, 92, 252, 0.16);
  border-radius: 17px;
  background: linear-gradient(145deg, rgba(124, 92, 252, 0.14), rgba(56, 189, 248, 0.07));
  color: var(--vp-c-brand-1);
}

.risk-icon svg {
  width: 26px;
  height: 26px;
}

.risk-icon--invalid {
  border-color: rgba(245, 158, 11, 0.22);
  background: linear-gradient(145deg, rgba(245, 158, 11, 0.14), rgba(245, 158, 11, 0.04));
  color: #d97706;
}

.risk-eyebrow {
  margin: 0 0 7px;
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
}

.risk-content h1,
.risk-checking h1 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(1.75rem, 3.5vw, 2.25rem);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.2;
}

.risk-desc {
  max-width: 490px;
  margin: 10px auto 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.8;
}

.risk-target {
  margin: 22px 0 18px;
  padding: 14px 16px 13px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 15px;
  background: var(--vp-c-bg);
  text-align: left;
}

.risk-target--http {
  border-color: rgba(245, 158, 11, 0.32);
}

.risk-target__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
  color: var(--vp-c-text-3);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.risk-protocol {
  flex: none;
  color: var(--vp-c-text-3);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.risk-protocol--http {
  color: #d97706;
}

.risk-target__host {
  display: block;
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-target__url {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.risk-target__url code {
  min-width: 0;
  overflow: hidden;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-copy {
  flex: none;
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.risk-copy:hover,
.risk-copy.is-copied {
  border-color: rgba(124, 92, 252, 0.32);
  background: rgba(124, 92, 252, 0.08);
  color: var(--vp-c-brand-1);
}

.risk-tips {
  display: grid;
  gap: 7px;
  margin: 0 0 22px;
  padding: 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.65;
  text-align: left;
  list-style: none;
}

.risk-tips li {
  position: relative;
  padding-left: 13px;
}

.risk-tips li::before {
  position: absolute;
  top: 0.64em;
  left: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--vp-c-brand-3);
  content: "";
}

.risk-actions {
  display: flex;
  gap: 10px;
}

.risk-content--invalid .risk-actions {
  margin-top: 22px;
}

.risk-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 43px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 650;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.risk-btn svg {
  width: 16px;
  height: 16px;
}

.risk-btn--primary {
  flex: 1;
  border: 1px solid transparent;
  background: linear-gradient(135deg, #7c5cfc, #9a7cfd);
  color: #fff;
  box-shadow: 0 8px 20px rgba(124, 92, 252, 0.24);
}

.risk-btn--primary:hover {
  box-shadow: 0 10px 26px rgba(124, 92, 252, 0.32);
  transform: translateY(-1px);
}

.risk-btn--ghost {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
}

.risk-btn--ghost:hover {
  border-color: rgba(124, 92, 252, 0.32);
  color: var(--vp-c-brand-1);
}

.risk-foot {
  margin: 13px 0 0;
  color: var(--vp-c-text-3);
  font-size: 10.5px;
  line-height: 1.65;
}

.risk-page__footer {
  position: relative;
  z-index: 1;
  margin: 0;
  color: var(--vp-c-text-3);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.risk-checking {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.risk-spinner {
  width: 22px;
  height: 22px;
  margin-bottom: 18px;
  border: 2px solid rgba(124, 92, 252, 0.18);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: risk-spin 0.8s linear infinite;
}

.risk-checking .risk-eyebrow {
  margin-top: 0;
}

@keyframes risk-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes risk-card-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .risk-page {
    padding: 28px 14px 22px;
  }

  .risk-card {
    padding: 20px 18px 22px;
    border-radius: 20px;
  }

  .risk-brand {
    padding-bottom: 14px;
  }

  .risk-brand__badge {
    padding: 4px 8px;
    font-size: 10px;
  }

  .risk-content,
  .risk-checking {
    padding-top: 22px;
  }

  .risk-icon {
    width: 48px;
    height: 48px;
    border-radius: 15px;
  }

  .risk-icon svg {
    width: 23px;
    height: 23px;
  }

  .risk-content h1,
  .risk-checking h1 {
    font-size: 1.65rem;
  }

  .risk-desc {
    font-size: 13px;
  }

  .risk-target {
    margin-top: 19px;
    padding: 12px 13px;
  }

  .risk-target__host {
    font-size: 15px;
  }

  .risk-target__url code {
    font-size: 10.5px;
  }

  .risk-tips {
    font-size: 11.5px;
  }

  .risk-actions {
    flex-direction: column;
  }

  .risk-btn {
    flex: none;
    width: 100%;
    height: 42px;
  }

  .risk-btn--ghost {
    order: 2;
  }
}

@media (max-width: 360px) {
  .risk-page {
    padding-right: 10px;
    padding-left: 10px;
  }

  .risk-card {
    padding: 17px 14px 19px;
  }

  .risk-brand__name {
    max-width: 120px;
  }

  .risk-content h1,
  .risk-checking h1 {
    font-size: 1.5rem;
  }

  .risk-target__host {
    font-size: 14px;
  }

  .risk-target__head {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .risk-card {
    animation: none;
  }

  .risk-spinner {
    animation-duration: 1.8s;
  }
}
</style>
