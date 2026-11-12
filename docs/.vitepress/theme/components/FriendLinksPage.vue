<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { withBase } from 'vitepress'
import { FRIEND_LINKS } from '../../data/friendLinks'

const friendLinks = FRIEND_LINKS

const site = {
  name: "Weno's Blog",
  desc: '记录学习、研究与生活的个人知识库',
  url: 'https://blogs.lovetulin.cn',
  logo: 'https://blogs.lovetulin.cn/tx.jpg',
  rss: 'https://blogs.lovetulin.cn/feed.xml',
  email: 'zwn200401@gmail.com',
}

const siteInfo = [
  { key: 'name', label: '名称', value: site.name },
  { key: 'desc', label: '描述', value: site.desc },
  { key: 'url', label: '地址', value: site.url },
  { key: 'logo', label: 'Logo', value: site.logo, avatar: site.logo },
  { key: 'rss', label: '订阅', value: site.rss },
]

const guidelines = [
  '站点可正常访问，内容合法合规，无广告、木马、敏感、色情、暴力、血腥等恶意内容',
  '有一定原创内容，且保持基本更新，不反对使用 AI 辅助博客创作，但主要依靠AI创作的内容，必须标注 AIGC，且不计入原创文章',
  '请先添加本站链接，再在留言板留言或发送邮件申请',
  '邮件主题请注明「友链」，附上站点名称、链接、头像和一句话描述',
  '如果站点长期无法访问或停止更新，后期可能会被移除'
]

const guestbookUrl = withBase('/guestbook')
const emailUrl = `mailto:${site.email}`

const failedAvatars = ref<Record<string, boolean>>({})
const copiedKey = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const assetUrl = (src?: string) => {
  if (!src) return ''
  return /^https?:\/\//i.test(src) ? src : withBase(src)
}

const markAvatarFailed = (key: string) => {
  failedAvatars.value = { ...failedAvatars.value, [key]: true }
}

const fallbackCopy = (value: string) => {
  const el = document.createElement('textarea')
  el.value = value
  el.setAttribute('readonly', '')
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(el)
  return ok
}

const copyText = async (value: string, key: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else if (!fallbackCopy(value)) {
      return
    }
  } catch {
    if (!fallbackCopy(value)) return
  }

  copiedKey.value = key
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedKey.value = ''
  }, 1600)
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="links-page">
    <div class="links-page__texture" aria-hidden="true"></div>

    <div class="links-shell">
      <header class="links-intro">
        <p class="links-eyebrow">FRIEND LINKS</p>
        <h1>友情链接</h1>
        <p class="links-intro__sub">
          山不来就我，我便去就山。欢迎交换友链，一起在互联网上留下痕迹。
        </p>
      </header>

      <section class="links-panel" aria-label="友链说明与本站信息">
        <div class="links-panel__col">
          <div class="links-heading">
            <span class="links-heading__mark" aria-hidden="true">◆</span>
            <h2>友链说明</h2>
            <span class="links-heading__en">GUIDELINES</span>
          </div>
          <ol class="links-rules">
            <li v-for="(rule, index) in guidelines" :key="rule">
              <span class="links-rules__num">{{ String(index + 1).padStart(2, '0') }}</span>
              <span>{{ rule }}</span>
            </li>
          </ol>
        </div>

        <div class="links-panel__col">
          <div class="links-heading">
            <span class="links-heading__mark" aria-hidden="true">◆</span>
            <h2>本站信息</h2>
            <span class="links-heading__en">SITE INFO</span>
          </div>
          <div class="links-info">
            <div v-for="item in siteInfo" :key="item.key" class="links-info__row">
              <span class="links-info__label">{{ item.label }}</span>
              <span class="links-info__value">
                <img
                  v-if="item.avatar"
                  :src="item.avatar"
                  alt=""
                  class="links-info__logo"
                  loading="lazy"
                  decoding="async"
                />
                <span class="links-info__text">{{ item.value }}</span>
              </span>
              <button
                type="button"
                class="links-copy"
                :class="{ 'is-copied': copiedKey === item.key }"
                :aria-label="`复制${item.label}`"
                :title="`复制${item.label}`"
                @click="copyText(item.value, item.key)"
              >
                <svg v-if="copiedKey !== item.key" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="links-friends" aria-labelledby="friends-title">
        <div class="links-section-head">
          <div>
            <p class="links-eyebrow">FRIENDS</p>
            <h2 id="friends-title">朋友们</h2>
          </div>
          <span class="links-count">{{ friendLinks.length }} 个站点</span>
        </div>

        <div v-if="friendLinks.length" class="links-grid">
          <a
            v-for="item in friendLinks"
            :key="item.link"
            class="links-card"
            :href="item.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="links-avatar">
              <img
                v-if="item.avatar && !failedAvatars[item.link]"
                :src="assetUrl(item.avatar)"
                :alt="`${item.name} 头像`"
                loading="lazy"
                decoding="async"
                @error="markAvatarFailed(item.link)"
              />
              <span v-else class="links-avatar__fallback">{{ item.name.slice(0, 1) }}</span>
            </span>
            <span class="links-card__body">
              <strong>{{ item.name }}</strong>
              <span>{{ item.desc }}</span>
            </span>
            <span class="links-card__arrow" aria-hidden="true">↗</span>
          </a>
        </div>

        <div v-else class="links-empty">
          <p class="links-empty__icon" aria-hidden="true">🫧</p>
          <h3>这里还空着</h3>
          <p>还没有友链，欢迎成为第一位朋友。</p>
          <div class="links-empty__actions">
            <a class="links-btn links-btn--primary" :href="guestbookUrl">去留言板</a>
            <a class="links-btn" :href="emailUrl">发送邮件</a>
          </div>
        </div>
      </section>

      <section class="links-apply">
        <div class="links-apply__copy">
          <p class="links-eyebrow">APPLY</p>
          <h2>想交换友链？</h2>
          <p>
            在留言板留言，或发送邮件至
            <a :href="emailUrl">{{ site.email }}</a>，附上站点名称、链接、头像和一句话描述。
          </p>
        </div>
        <div class="links-apply__actions">
          <a class="links-btn links-btn--primary" :href="guestbookUrl">
            去留言板 <span aria-hidden="true">↗</span>
          </a>
          <a class="links-btn" :href="emailUrl">发送邮件</a>
        </div>
      </section>

      <span class="sr-only" role="status" aria-live="polite">
        {{ copiedKey ? '已复制' : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.links-page {
  position: relative;
  isolation: isolate;
  padding: 8px 0 64px;
}

.links-page__texture {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image: radial-gradient(circle, var(--vp-c-divider) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.45;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 72%);
  mask-image: linear-gradient(to bottom, #000 0%, transparent 72%);
  pointer-events: none;
}

.links-shell {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.links-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  line-height: 1.4;
}

.links-intro {
  margin: 4px 0 28px;
}

.links-intro h1 {
  margin: 0 0 10px;
  color: var(--vp-c-text-1);
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.links-intro__sub {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 14.5px;
  line-height: 1.8;
}

.links-panel {
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background: var(--vp-c-bg);
  box-shadow: 0 14px 44px rgba(15, 23, 42, 0.06);
}

.links-panel__col {
  min-width: 0;
  padding: 28px 30px 26px;
}

.links-panel__col + .links-panel__col {
  border-left: 1px solid var(--vp-c-divider);
}

.links-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 20px;
}

.links-heading::after {
  content: '';
  flex: 1;
  height: 1px;
  margin-left: 4px;
  background: var(--vp-c-divider);
}

.links-heading__mark {
  color: var(--vp-c-brand-1);
  font-size: 9px;
  line-height: 1;
}

.links-heading h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

.links-heading__en {
  color: var(--vp-c-text-3);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  line-height: 1.4;
  white-space: nowrap;
}

.links-rules {
  display: grid;
  gap: 15px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.links-rules li {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 10px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.75;
}

.links-rules__num {
  padding-top: 2px;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.links-info {
  display: grid;
}

.links-info__row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 28px;
  gap: 10px;
  align-items: center;
  padding: 11px 0;
}

.links-info__row + .links-info__row {
  border-top: 1px solid var(--vp-c-divider);
}

.links-info__label {
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.5;
}

.links-info__value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.links-info__logo {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border-radius: 5px;
  object-fit: cover;
}

.links-info__text {
  min-width: 0;
  color: var(--vp-c-text-1);
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.links-copy {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.links-copy svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.links-copy:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.links-copy.is-copied {
  color: #10b981;
}

.links-friends {
  margin-top: 30px;
}

.links-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.links-section-head h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.links-section-head .links-eyebrow {
  margin-bottom: 5px;
}

.links-count {
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.links-card {
  display: grid;
  min-width: 0;
  min-height: 98px;
  grid-template-columns: 56px minmax(0, 1fr) 18px;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg);
  color: inherit;
  text-decoration: none;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
}

.links-card:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.links-avatar {
  display: grid;
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  background: var(--vp-c-bg-soft);
}

.links-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff;
  object-fit: cover;
}

.links-avatar__fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  background: linear-gradient(135deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.links-card__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.links-card__body strong {
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.links-card__body span {
  overflow: hidden;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.links-card__arrow {
  color: var(--vp-c-text-3);
  font-size: 14px;
  line-height: 1;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.links-card:hover .links-card__arrow {
  opacity: 1;
  transform: translateX(0);
}

.links-empty {
  padding: 38px 24px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
  text-align: center;
}

.links-empty__icon {
  margin: 0 0 8px;
  font-size: 26px;
  line-height: 1;
}

.links-empty h3 {
  margin: 0 0 6px;
  color: var(--vp-c-text-1);
  font-size: 18px;
  font-weight: 600;
}

.links-empty p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  line-height: 1.7;
}

.links-empty__actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}

.links-apply {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 30px;
  padding: 24px 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  background:
    radial-gradient(120% 180% at 0% 0%, color-mix(in srgb, var(--vp-c-brand-1) 7%, transparent), transparent 58%),
    var(--vp-c-bg-soft);
}

.links-apply__copy {
  min-width: 0;
}

.links-apply h2 {
  margin: 0 0 8px;
  color: var(--vp-c-text-1);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.links-apply p {
  max-width: 680px;
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 13.5px;
  line-height: 1.75;
}

.links-apply p a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.links-apply p a:hover {
  text-decoration: underline;
}

.links-apply__note {
  margin-top: 6px !important;
  color: var(--vp-c-text-3) !important;
  font-size: 12px !important;
}

.links-apply__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
}

.links-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.4;
  text-decoration: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.links-btn:hover {
  border-color: var(--vp-c-brand-1);
}

.links-btn--primary {
  border-color: transparent;
  background: var(--vp-c-brand-1);
  color: #fff;
}

.links-btn--primary:hover {
  background: var(--vp-c-brand-2);
  opacity: 0.92;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  clip-path: inset(50%);
}

@media (max-width: 960px) {
  .links-shell {
    padding-right: 20px;
    padding-left: 20px;
  }
}

@media (max-width: 1024px) {
  .links-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .links-panel {
    grid-template-columns: 1fr;
  }

  .links-panel__col + .links-panel__col {
    border-top: 1px solid var(--vp-c-divider);
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .links-page {
    padding-bottom: 48px;
  }

  .links-shell {
    padding-right: 16px;
    padding-left: 16px;
  }

  .links-page__texture {
    background-size: 22px 22px;
  }

  .links-intro {
    margin-bottom: 22px;
  }

  .links-intro h1 {
    font-size: 28px;
  }

  .links-intro__sub {
    font-size: 13.5px;
  }

  .links-panel {
    border-radius: 16px;
  }

  .links-panel__col {
    padding: 22px 20px;
  }

  .links-heading {
    margin-bottom: 16px;
  }

  .links-heading__en {
    display: none;
  }

  .links-heading::after {
    display: none;
  }

  .links-rules {
    gap: 12px;
  }

  .links-rules li {
    font-size: 13.5px;
  }

  .links-info__row {
    grid-template-columns: 46px minmax(0, 1fr) 32px;
  }

  .links-copy {
    width: 32px;
    height: 32px;
  }

  .links-info__text {
    font-size: 12.5px;
  }

  .links-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .links-card {
    min-height: 90px;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 12px;
    padding: 16px;
  }

  .links-avatar {
    width: 52px;
    height: 52px;
  }

  .links-card__arrow {
    display: none;
  }

  .links-apply {
    align-items: stretch;
    flex-direction: column;
    gap: 18px;
    padding: 22px 20px;
    border-radius: 16px;
  }

  .links-apply__actions {
    width: 100%;
  }

  .links-apply__actions .links-btn {
    flex: 1;
  }
}

@media (max-width: 360px) {
  .links-intro h1 {
    font-size: 26px;
  }

  .links-panel__col {
    padding: 20px 16px;
  }

  .links-info__row {
    grid-template-columns: 40px minmax(0, 1fr) 30px;
    gap: 8px;
  }

  .links-copy {
    width: 30px;
    height: 30px;
  }

  .links-empty__actions {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .links-card,
  .links-card__arrow,
  .links-copy,
  .links-btn {
    transition: none;
  }

  .links-card:hover {
    transform: none;
  }
}
</style>

<style>
/* 暗色覆盖写成全局样式：scoped + :global(html.dark) 在 Vue SFC 中会被错误编译为
   html.dark { ... }，曾导致整页 opacity: 0.22。这里用 .links-page 前缀限定作用域。 */
html.dark .links-page .links-panel,
html.dark .links-page .links-card {
  box-shadow: none;
}

html.dark .links-page .links-page__texture {
  opacity: 0.22;
}
</style>
