<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'
import { maskEmail } from '../auth/client'
import { useAuth } from '../auth/useAuth'

interface TwikooComment {
  id?: string
  nick?: string
  avatar?: string
  comment?: string
  created?: number
  master?: boolean
  isSpam?: boolean
  link?: string
  mailMd5?: string
  os?: string
  browser?: string
  ipRegion?: string
  ruser?: string
  pid?: string
  rid?: string
  replies?: TwikooComment[]
}

interface WallSegment {
  type: 'text' | 'image'
  text?: string
  url?: string
  alt?: string
}

interface WallComment {
  id: string
  nick: string
  avatar: string
  link: string
  segments: WallSegment[]
  created: number
  os: string
  browser: string
  ipRegion: string
  master: boolean
  replyTo: string
  parentId: string
  rootId: string
  replies: WallComment[]
}

interface TwikooResponse {
  code?: number
  message?: string
  data?: TwikooComment[] | { url?: string }
  count?: number
}

const { theme } = useData()
const { user, ready: authReady, openLogin } = useAuth()

const FALLBACK_TWIKOO_ENDPOINT = 'https://blogs.lovetulin.cn/twikoo-api'
const COMMENT_URL = '/guestbook'
const WEBSITE_KEY = 'guestbook-website'
const MAX_COMMENT = 1000
const MAX_IMAGES = 4
const MAX_IMAGE_MB = 5

const twikooEndpoint = computed(() => {
  const comment = (theme.value as {
    comment?: { options?: { envId?: string } }
  }).comment
  const envId = comment?.options?.envId
  return typeof envId === 'string' && envId ? envId : FALLBACK_TWIKOO_ENDPOINT
})

let configReady = false

const twikooCall = async (
  event: string,
  payload: Record<string, unknown> = {},
): Promise<TwikooResponse> => {
  const endpoint = twikooEndpoint.value
  if (!/^https?:\/\//.test(endpoint)) throw new Error('留言服务未配置')

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      envId: endpoint,
      ...payload,
    }),
  })

  if (!response.ok) throw new Error(`留言服务返回 ${response.status}`)

  const result = (await response.json()) as TwikooResponse

  if (typeof result.code === 'number' && result.code !== 0) {
    throw new Error(result.message || '留言服务暂不可用')
  }

  return result
}

const ensureConfig = async () => {
  if (configReady) return
  await twikooCall('GET_CONFIG')
  configReady = true
}

const decodeText = (input: string) => {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const weavatarUrl = (hash: string, size = 80) =>
  `https://weavatar.com/avatar/${hash}?d=mp&s=${size}`


const safeHttpUrl = (value: string) => {
  const raw = value.trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

const normalizeWebsite = (value: string) => {
  const raw = value.trim()
  if (!raw) return ''
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return safeHttpUrl(withProtocol)
}

// 把 Twikoo 返回的 Markdown/HTML 图片拆成文本与图片片段，保留文字换行
const parseComment = (input: string): WallSegment[] => {
  const segments: WallSegment[] = []
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = imagePattern.exec(input))) {
    const before = decodeText(input.slice(cursor, match.index))
    if (before) segments.push({ type: 'text', text: before })

    const url = safeHttpUrl(match[2] || match[3] || '')
    if (url) {
      segments.push({
        type: 'image',
        url,
        alt: match[1] || '留言图片',
      })
    }
    cursor = match.index + match[0].length
  }

  const tail = decodeText(input.slice(cursor))
  if (tail) segments.push({ type: 'text', text: tail })
  return segments
}

const comments = ref<WallComment[]>([])
const commentCount = ref(0)
const loading = ref(true)
const loadError = ref('')

const toWallComment = (raw: TwikooComment, parentId = '', rootId = ''): WallComment | null => {
  if (raw.isSpam) return null
  const rawComment = String(raw.comment || '')
  const segments = parseComment(rawComment)
  if (!segments.length) return null

  const id = String(raw.id || `${raw.created || 0}-${raw.nick || ''}`)
  const mailMd5 = String(raw.mailMd5 || '')
  const avatar = String(raw.avatar || '') || (mailMd5 ? weavatarUrl(mailMd5) : '')

  return {
    id,
    nick: String(raw.nick || '访客'),
    avatar,
    link: safeHttpUrl(String(raw.link || '')),
    segments,
    created: Number(raw.created) || 0,
    os: String(raw.os || '').trim(),
    browser: String(raw.browser || '').trim(),
    ipRegion: String(raw.ipRegion || '').trim(),
    master: Boolean(raw.master),
    replyTo: String(raw.ruser || ''),
    parentId,
    rootId: rootId || id,
    replies: [],
  }
}

const loadComments = async () => {
  loading.value = true
  loadError.value = ''
  try {
    await ensureConfig()
    const result = await twikooCall('COMMENT_GET', {
      url: COMMENT_URL,
      sort: 'newest',
      page: 1,
      pageSize: 200,
    })

    const list: WallComment[] = []
    const seen = new Set<string>()
    const rows = Array.isArray(result.data) ? result.data : []

    for (const raw of rows) {
      const comment = toWallComment(raw)
      if (!comment || seen.has(comment.id)) continue
      seen.add(comment.id)

      for (const childRaw of Array.isArray(raw.replies) ? raw.replies : []) {
        const child = toWallComment(childRaw, comment.id, comment.id)
        if (!child || seen.has(child.id)) continue
        seen.add(child.id)
        comment.replies.push(child)
      }

      list.push(comment)
    }

    comments.value = list
    commentCount.value = list.reduce((total, item) => total + 1 + item.replies.length, 0)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '留言加载失败'
  } finally {
    loading.value = false
  }
}

const formatDateTime = (timestamp: number) => {
  if (!timestamp) return '时间未知'
  const normalized = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return '时间未知'

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`
}

const isoDateTime = (timestamp: number) => {
  if (!timestamp) return ''
  const normalized = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

const metaPlace = (value: string) => value.trim() || '未知地区'

const normalizeBrowser = (value: string) => {
  const browser = value.trim()
  if (!browser) return ''
  if (/edg|edge/i.test(browser)) return 'Edge'
  if (/opr|opera/i.test(browser)) return 'Opera'
  if (/chrome|crios/i.test(browser)) return 'Chrome'
  if (/firefox|fxios/i.test(browser)) return 'Firefox'
  if (/safari/i.test(browser)) return 'Safari'
  return browser.split(/\s+/)[0]
}

const normalizeOs = (value: string) => {
  const os = value.trim()
  if (!os) return ''
  if (/iphone|ipad|ios/i.test(os)) return 'iOS'
  if (/android/i.test(os)) return 'Android'
  if (/mac os|macos|macintosh/i.test(os)) return 'Mac'
  if (/windows/i.test(os)) return 'Windows'
  if (/linux/i.test(os)) return 'Linux'
  return os
}

const metaDevice = (comment: { os: string; browser: string }) => {
  return normalizeOs(comment.os) || normalizeBrowser(comment.browser) || '未知设备'
}

const website = ref('')
const content = ref('')
const submitting = ref(false)
const uploading = ref(false)
const formError = ref('')
const formSuccess = ref('')
const attachments = ref<{ url: string; name: string }[]>([])
const lightbox = ref<{ url: string; alt: string } | null>(null)
const websiteInput = ref<HTMLInputElement | null>(null)
const contentInput = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let successTimer: ReturnType<typeof setTimeout> | undefined

const maskedEmail = computed(() => (user.value ? maskEmail(user.value.email) : ''))

const emojis = ['👋', '😊', '💡', '❤️', '🎉', '🌿']

const insertEmoji = async (emoji: string) => {
  formError.value = ''
  const el = contentInput.value
  const start = el?.selectionStart ?? content.value.length
  const end = el?.selectionEnd ?? content.value.length
  content.value = `${content.value.slice(0, start)}${emoji}${content.value.slice(end)}`
  await nextTick()
  if (el) {
    el.focus()
    const position = start + emoji.length
    el.setSelectionRange(position, position)
  }
}

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })

const addFiles = async (files: FileList | File[]) => {
  const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
  if (!images.length) return

  formError.value = ''
  formSuccess.value = ''
  const remaining = MAX_IMAGES - attachments.value.length
  if (remaining <= 0) {
    formError.value = `最多插入 ${MAX_IMAGES} 张图片。`
    return
  }

  uploading.value = true
  try {
    for (const file of images.slice(0, remaining)) {
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        formError.value = `${file.name || '图片'} 超过 ${MAX_IMAGE_MB}MB，换一张小一点的吧。`
        continue
      }
      try {
        const photo = await readFileAsDataUrl(file)
        await ensureConfig()
        const result = await twikooCall('UPLOAD_IMAGE', {
          fileName: file.name || `guestbook-${Date.now()}.png`,
          photo,
        })
        const data = result.data
        const url = data && !Array.isArray(data) ? String(data.url || '') : ''
        if (!url) throw new Error('图片上传失败')
        attachments.value.push({ url, name: file.name || '留言图片' })
      } catch (error) {
        formError.value = error instanceof Error ? error.message : '图片上传失败，请重试。'
      }
    }
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const triggerFilePick = () => {
  if (uploading.value) return
  if (attachments.value.length >= MAX_IMAGES) {
    formError.value = `最多插入 ${MAX_IMAGES} 张图片。`
    return
  }
  fileInput.value?.click()
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files?.length) void addFiles(input.files)
}

const onPaste = (event: ClipboardEvent) => {
  const files = Array.from(event.clipboardData?.files || []).filter((file) =>
    file.type.startsWith('image/'),
  )
  if (files.length) {
    event.preventDefault()
    void addFiles(files)
  }
}

const removeAttachment = (index: number) => {
  attachments.value.splice(index, 1)
}

const openLightbox = (url: string, alt: string) => {
  lightbox.value = { url, alt }
}

const submitComment = async () => {
  if (submitting.value) return

  const current = user.value
  if (!current) {
    openLogin('登录后即可留言')
    return
  }

  const nick = current.nick
  const email = current.email
  const site = normalizeWebsite(website.value)
  const text = content.value.trim()

  formSuccess.value = ''
  if (website.value.trim() && !site) {
    formError.value = '网址格式好像不太对，试试 https://example.com。'
    websiteInput.value?.focus()
    return
  }
  if (!text && !attachments.value.length) {
    formError.value = '写点什么，或者插入一张图片吧。'
    contentInput.value?.focus()
    return
  }
  if (uploading.value) {
    formError.value = '图片还在上传，稍等一下再发送。'
    return
  }

  submitting.value = true
  formError.value = ''

  try {
    await ensureConfig()
    const imageMarkdown = attachments.value
      .map((item) => `![${item.name.replace(/[\[\]]/g, ' ')}](${item.url})`)
      .join('\n')
    const commentBody = [text, imageMarkdown].filter(Boolean).join('\n\n')

    await twikooCall('COMMENT_SUBMIT', {
      url: COMMENT_URL,
      nick,
      mail: email,
      link: site,
      comment: commentBody,
      ua: navigator.userAgent,
    })

    try {
      localStorage.setItem(WEBSITE_KEY, site)
    } catch {
      // ignore
    }

    content.value = ''
    attachments.value = []
    formSuccess.value = '留言已送达，谢谢你。'
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      formSuccess.value = ''
    }, 6000)
    await loadComments()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '发送失败，请稍后重试。'
  } finally {
    submitting.value = false
  }
}

const replyTarget = ref<WallComment | null>(null)
const replyText = ref('')
const replyError = ref('')
const replying = ref(false)
const replyInput = ref<HTMLTextAreaElement | null>(null)

const pendingReply = ref<WallComment | null>(null)

const openReply = (comment: WallComment) => {
  if (!user.value) {
    pendingReply.value = comment
    openLogin('登录后即可回复')
    return
  }
  pendingReply.value = null
  replyTarget.value = comment
  replyText.value = ''
  replyError.value = ''
  void nextTick(() => replyInput.value?.focus())
}

watch(user, (current) => {
  if (current && pendingReply.value) {
    const target = pendingReply.value
    pendingReply.value = null
    openReply(target)
  }
})

const cancelReply = () => {
  replyTarget.value = null
  replyText.value = ''
  replyError.value = ''
}

const submitReply = async () => {
  const target = replyTarget.value
  if (!target || replying.value) return

  const current = user.value
  if (!current) {
    openLogin('登录后即可回复')
    return
  }

  const nick = current.nick
  const email = current.email
  const text = replyText.value.trim()

  replyError.value = ''
  if (!text) {
    replyError.value = '写点什么再发送吧。'
    return
  }

  replying.value = true
  try {
    await ensureConfig()
    const commentBody = text

    await twikooCall('COMMENT_SUBMIT', {
      url: COMMENT_URL,
      nick,
      mail: email,
      link: normalizeWebsite(website.value),
      comment: commentBody,
      pid: target.parentId || target.id,
      rid: target.id,
      ua: navigator.userAgent,
    })

    try {
      localStorage.setItem(WEBSITE_KEY, normalizeWebsite(website.value))
    } catch {
      // ignore
    }

    replyText.value = ''
    replyTarget.value = null
    await loadComments()
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : '回复失败，请稍后重试。'
  } finally {
    replying.value = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') lightbox.value = null
}

onMounted(() => {
  try {
    website.value = localStorage.getItem(WEBSITE_KEY) || ''
  } catch {
    // ignore
  }
  window.addEventListener('keydown', onKeydown)
  void loadComments()
})

onBeforeUnmount(() => {
  if (successTimer) clearTimeout(successTimer)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="guestbook-page">
    <div class="guestbook-shell">
      <header class="guestbook-hero">
        <p class="guestbook-eyebrow">GUESTBOOK · 留言板</p>
        <h1>留言板</h1>
        <p class="guestbook-hero__desc">
          把想说的话留在这里。无论是打个招呼、聊聊技术，还是反馈站点问题，我都会认真读。
        </p>
      </header>

      <div class="guestbook-top">
        <aside class="guestbook-side" aria-label="关于我">
          <div class="guestbook-profile">
            <span class="guestbook-avatar">
              <img :src="withBase('/tx.jpg')" alt="weno 的头像" loading="lazy" />
            </span>
            <div class="guestbook-profile__text">
              <p class="guestbook-name">
                weno
                <span class="guestbook-badge">博主</span>
              </p>
              <p class="guestbook-bio">记录学习、研究与生活。</p>
            </div>
          </div>

          <p class="guestbook-side__copy">
            这里像一间小小的数字客厅。留言不必正式，想到什么就写什么，看到后会尽快回复。
          </p>

          <div class="guestbook-contact">
            <a href="https://github.com/doublenuo" target="_blank" rel="noopener noreferrer">
              <span>GitHub</span>
              <span aria-hidden="true">↗</span>
            </a>
            <a href="mailto:zwn200401@gmail.com">
              <span>Email</span>
              <span aria-hidden="true">↗</span>
            </a>
            <a :href="withBase('/feed.xml')">
              <span>RSS</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>

          <p class="guestbook-side__note">
            <span class="guestbook-dot" aria-hidden="true"></span>
            通常 1–2 天内回复
          </p>

          <div class="guestbook-rules">
            <p class="guestbook-rules__title">留言前的小约定</p>
            <ul>
              <li>保持友善，尊重不同的声音</li>
              <li>技术问题尽量带上上下文</li>
              <li>广告和无关链接会被移除</li>
            </ul>
          </div>
        </aside>

        <section class="guestbook-form-card" aria-labelledby="guestbook-form-title">
          <div class="guestbook-form-head">
            <p class="guestbook-eyebrow">LEAVE A NOTE</p>
            <h2 id="guestbook-form-title">写点什么</h2>
            <p>登录后即可留言；昵称会显示在留言墙，邮箱不会公开。</p>
          </div>

          <div v-if="!authReady" class="guestbook-auth-state" role="status">
            正在检查登录状态…
          </div>
          <div v-else-if="!user" class="guestbook-auth-card">
            <div>
              <strong>登录后留言</strong>
              <p>使用 GitHub 或邮箱验证码登录，一次登录即可在全站评论。</p>
            </div>
            <button type="button" class="guestbook-submit" @click="openLogin('登录后即可留言')">
              登录
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <form v-else class="guestbook-form" novalidate @submit.prevent="submitComment">
            <div class="guestbook-identity">
              <span class="guestbook-identity__avatar" aria-hidden="true">{{ user.nick.slice(0, 1) }}</span>
              <div>
                <strong>以 {{ user.nick }} 留言</strong>
                <p>{{ maskedEmail }} · 邮箱已验证</p>
              </div>
            </div>

            <div class="guestbook-fields">
              <label class="guestbook-field">
                <span>网址</span>
                <input
                  ref="websiteInput"
                  v-model="website"
                  type="url"
                  maxlength="120"
                  autocomplete="url"
                  placeholder="选填，显示为链接"
                  @input="formError = ''"
                />
              </label>
            </div>

            <label class="guestbook-field guestbook-field--message">
              <span>留言 <em>*</em></span>
              <textarea
                ref="contentInput"
                v-model="content"
                :maxlength="MAX_COMMENT"
                rows="5"
                placeholder="想聊什么都可以，友善就好…"
                @input="formError = ''"
                @paste="onPaste"
              />
            </label>

            <div v-if="attachments.length || uploading" class="guestbook-attachments">
              <div v-for="(attachment, index) in attachments" :key="attachment.url" class="guestbook-attachment">
                <img
                  :src="attachment.url"
                  :alt="attachment.name"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <button
                  type="button"
                  :aria-label="`移除 ${attachment.name}`"
                  @click="removeAttachment(index)"
                >
                  ×
                </button>
              </div>
              <div v-if="uploading" class="guestbook-attachment is-uploading">
                <span aria-hidden="true">＋</span>
                上传中…
              </div>
            </div>

            <div class="guestbook-form__bottom">
              <button
                class="guestbook-image-btn"
                type="button"
                :disabled="uploading"
                aria-label="插入图片"
                @click="triggerFilePick"
              >
                <span aria-hidden="true">▧</span>
                图片
              </button>
              <input
                ref="fileInput"
                class="guestbook-file"
                type="file"
                accept="image/*"
                multiple
                @change="onFileChange"
              />
              <div class="guestbook-emojis" aria-label="插入表情">
                <button
                  v-for="emoji in emojis"
                  :key="emoji"
                  type="button"
                  :aria-label="`插入 ${emoji}`"
                  @click="insertEmoji(emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
              <span class="guestbook-counter">{{ content.length }} / {{ MAX_COMMENT }}</span>
              <button class="guestbook-submit" type="submit" :disabled="submitting">
                {{ submitting ? '发送中…' : '发送留言' }}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <p v-if="formError" class="guestbook-form__error" role="alert">{{ formError }}</p>
            <p v-if="formSuccess" class="guestbook-form__success" role="status">{{ formSuccess }}</p>
          </form>

          <p class="guestbook-form__note">邮箱仅用于评论身份验证，不会公开；网址会显示在昵称旁。请保持友善。</p>
        </section>
      </div>

      <section class="guestbook-wall" aria-labelledby="guestbook-wall-title">
        <div class="guestbook-wall__head">
          <div>
            <p class="guestbook-eyebrow">MESSAGES</p>
            <h2 id="guestbook-wall-title">留言墙</h2>
          </div>
          <span class="guestbook-wall__count">{{ commentCount }} 条</span>
        </div>

        <div v-if="loading" class="guestbook-skeleton" aria-label="留言加载中">
          <div v-for="item in 3" :key="item" class="guestbook-skeleton__row">
            <span class="guestbook-skeleton__avatar" />
            <div>
              <span class="guestbook-skeleton__line guestbook-skeleton__line--short" />
              <span class="guestbook-skeleton__line" />
              <span class="guestbook-skeleton__line guestbook-skeleton__line--medium" />
            </div>
          </div>
        </div>

        <div v-else-if="loadError" class="guestbook-state">
          <p class="guestbook-state__icon" aria-hidden="true">☁</p>
          <p class="guestbook-state__title">留言暂时没有加载出来</p>
          <p class="guestbook-state__desc">{{ loadError }}</p>
          <button type="button" class="guestbook-retry" @click="loadComments">再试一次</button>
        </div>

        <div v-else-if="!comments.length" class="guestbook-state">
          <p class="guestbook-state__icon" aria-hidden="true">✉</p>
          <p class="guestbook-state__title">还没有留言</p>
          <p class="guestbook-state__desc">来坐第一排吧，说点什么都可以。</p>
        </div>

        <ul v-else class="guestbook-list">
          <li v-for="comment in comments" :key="comment.id" class="guestbook-comment">
            <span class="guestbook-comment__avatar">
              <img
                v-if="comment.avatar"
                :src="comment.avatar"
                :alt="`${comment.nick} 的头像`"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <span v-else aria-hidden="true">{{ comment.nick.slice(0, 1).toUpperCase() }}</span>
            </span>
            <div class="guestbook-comment__body">
              <div class="guestbook-comment__meta">
                <span class="guestbook-comment__nick">
                  <a
                    v-if="comment.link"
                    :href="comment.link"
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >{{ comment.nick }}</a>
                  <template v-else>{{ comment.nick }}</template>
                  <span v-if="comment.master" class="guestbook-badge">博主</span>
                </span>
                <button type="button" class="guestbook-comment__reply" @click="openReply(comment)">
                  回复
                </button>
              </div>
              <div class="guestbook-meta" aria-label="留言信息">
                <span class="guestbook-meta__item guestbook-meta__item--time">
                  <time :datetime="isoDateTime(comment.created)">{{ formatDateTime(comment.created) }}</time>
                </span>
                <span class="guestbook-meta__item" title="留言地点">{{ metaPlace(comment.ipRegion) }}</span>
                <span class="guestbook-meta__item" title="设备">{{ metaDevice(comment) }}</span>
              </div>
              <div class="guestbook-comment__content">
                <template v-for="(segment, index) in comment.segments" :key="index">
                  <p v-if="segment.type === 'text'" class="guestbook-comment__text">{{ segment.text }}</p>
                  <button
                    v-else
                    type="button"
                    class="guestbook-comment__image"
                    @click="openLightbox(segment.url || '', segment.alt || '留言图片')"
                  >
                    <img
                      :src="segment.url"
                      :alt="segment.alt || '留言图片'"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                    />
                  </button>
                </template>
              </div>

              <ul v-if="comment.replies.length" class="guestbook-replies">
                <li v-for="reply in comment.replies" :key="reply.id" class="guestbook-reply">
                  <span class="guestbook-reply__avatar">
                    <img
                      v-if="reply.avatar"
                      :src="reply.avatar"
                      :alt="`${reply.nick} 的头像`"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                    />
                    <span v-else aria-hidden="true">{{ reply.nick.slice(0, 1).toUpperCase() }}</span>
                  </span>
                  <div class="guestbook-reply__body">
                    <div class="guestbook-reply__meta">
                      <span class="guestbook-reply__nick">
                        <a
                          v-if="reply.link"
                          :href="reply.link"
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >{{ reply.nick }}</a>
                        <template v-else>{{ reply.nick }}</template>
                        <span v-if="reply.master" class="guestbook-badge">博主</span>
                      </span>
                      <span v-if="reply.replyTo" class="guestbook-reply__to">回复 @{{ reply.replyTo }}</span>
                      <button type="button" class="guestbook-comment__reply" @click="openReply(reply)">
                        回复
                      </button>
                    </div>
                    <div class="guestbook-meta guestbook-meta--reply" aria-label="回复信息">
                      <span class="guestbook-meta__item guestbook-meta__item--time">
                        <time :datetime="isoDateTime(reply.created)">{{ formatDateTime(reply.created) }}</time>
                      </span>
                      <span class="guestbook-meta__item" title="留言地点">{{ metaPlace(reply.ipRegion) }}</span>
                      <span class="guestbook-meta__item" title="设备">{{ metaDevice(reply) }}</span>
                    </div>
                    <div class="guestbook-comment__content">
                      <template v-for="(segment, index) in reply.segments" :key="index">
                        <p v-if="segment.type === 'text'" class="guestbook-comment__text">{{ segment.text }}</p>
                        <button
                          v-else
                          type="button"
                          class="guestbook-comment__image"
                          @click="openLightbox(segment.url || '', segment.alt || '留言图片')"
                        >
                          <img
                            :src="segment.url"
                            :alt="segment.alt || '留言图片'"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                          />
                        </button>
                      </template>
                    </div>
                  </div>
                </li>
              </ul>

              <form
                v-if="replyTarget && replyTarget.rootId === comment.id"
                class="guestbook-reply-form"
                @submit.prevent="submitReply"
              >
                <div class="guestbook-reply-form__head">
                  <span>回复 <strong>@{{ replyTarget.nick }}</strong></span>
                  <button type="button" @click="cancelReply">取消</button>
                </div>
                <div v-if="!user" class="guestbook-reply-form__login">
                  登录状态已失效，请重新登录后再回复。
                  <button type="button" @click="openLogin('登录后即可回复')">登录</button>
                </div>
                <template v-else>
                  <div class="guestbook-reply-form__identity-note">
                    以 <strong>{{ user.nick }}</strong> 回复 · 邮箱已验证
                  </div>
                  <textarea
                    ref="replyInput"
                    v-model="replyText"
                    :maxlength="MAX_COMMENT"
                    rows="3"
                    :placeholder="`回复 @${replyTarget.nick}…`"
                    @input="replyError = ''"
                  />
                  <div class="guestbook-reply-form__bottom">
                    <span>{{ replyText.length }} / {{ MAX_COMMENT }}</span>
                    <button type="submit" :disabled="replying">
                      {{ replying ? '发送中…' : '发送回复' }}
                    </button>
                  </div>
                </template>
                <p v-if="replyError" class="guestbook-form__error" role="alert">{{ replyError }}</p>
              </form>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <Teleport to="body">
      <div
        v-if="lightbox"
        class="guestbook-lightbox"
      role="dialog"
      aria-modal="true"
      :aria-label="lightbox.alt"
      @click.self="lightbox = null"
    >
        <button type="button" class="guestbook-lightbox__close" aria-label="关闭图片" @click="lightbox = null">×</button>
        <img :src="lightbox.url" :alt="lightbox.alt" referrerpolicy="no-referrer" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.guestbook-page {
  --gb-radius: 20px;
  position: relative;
  overflow: hidden;
  padding: 8px 0 72px;
  background:
    radial-gradient(760px 380px at 12% -4%, rgba(124, 92, 252, 0.08), transparent 72%),
    radial-gradient(620px 320px at 92% 8%, rgba(56, 189, 248, 0.06), transparent 70%);
}

.guestbook-page::before {
  position: absolute;
  z-index: 0;
  inset: 0;
  background-image: radial-gradient(rgba(124, 92, 252, 0.16) 0.8px, transparent 0.8px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.28) 54%, transparent 92%);
  pointer-events: none;
  content: "";
}

.guestbook-shell {
  position: relative;
  z-index: 1;
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 24px;
}

.guestbook-hero {
  padding: 20px 2px 30px;
}

.guestbook-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1.4;
}

.guestbook-hero h1 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1.15;
}

.guestbook-hero__desc {
  max-width: 620px;
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 15px;
  line-height: 1.85;
}

.guestbook-top {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 18px;
  align-items: start;
}

.guestbook-side,
.guestbook-form-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--gb-radius);
  background: var(--vp-c-bg-soft);
  box-shadow: 0 12px 36px rgba(24, 24, 40, 0.045);
}

.guestbook-side {
  padding: 24px;
}

.guestbook-profile {
  display: flex;
  gap: 14px;
  align-items: center;
}

.guestbook-avatar {
  flex: 0 0 auto;
  width: 62px;
  height: 62px;
  overflow: hidden;
  border: 2px solid var(--vp-c-bg);
  border-radius: 50%;
  background: linear-gradient(145deg, #8b7cf6, #5bb8f5);
  box-shadow: 0 6px 16px rgba(124, 92, 252, 0.2);
}

.guestbook-avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.guestbook-name {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 17px;
  font-weight: 700;
}

.guestbook-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 26%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 9%, transparent);
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.7;
  vertical-align: middle;
}

.guestbook-bio {
  margin: 3px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.guestbook-side__copy {
  margin: 20px 0 18px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.85;
}

.guestbook-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.guestbook-contact a {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 7px 11px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 550;
  text-decoration: none;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
}

.guestbook-contact a:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, var(--vp-c-divider));
  color: var(--vp-c-brand-1);
  transform: translateY(-1px);
}

.guestbook-side__note {
  display: flex;
  gap: 7px;
  align-items: center;
  margin: 20px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.guestbook-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34c759;
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.12);
}

.guestbook-form-card {
  padding: 24px;
  background: var(--vp-c-bg-soft);
}

.guestbook-rules {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.guestbook-rules__title {
  margin: 0 0 8px;
  color: var(--vp-c-text-2);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.guestbook-rules ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.guestbook-rules li {
  position: relative;
  padding-left: 15px;
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 1.65;
}

.guestbook-rules li::before {
  position: absolute;
  top: 0.58em;
  left: 1px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--vp-c-brand-1) 55%, transparent);
  content: "";
}

.guestbook-form-head h2,
.guestbook-wall__head h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 22px;
  font-weight: 720;
  letter-spacing: -0.03em;
}

.guestbook-form-head > p:last-child {
  margin: 7px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.6;
}

.guestbook-form {
  display: grid;
  gap: 13px;
  margin-top: 18px;
}

.guestbook-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.guestbook-form > .guestbook-fields {
  grid-template-columns: minmax(0, 1fr);
}

.guestbook-auth-state {
  margin-top: 18px;
  padding: 16px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 13px;
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  text-align: center;
}

.guestbook-auth-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 13px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 4%, var(--vp-c-bg));
}

.guestbook-auth-card strong {
  color: var(--vp-c-text-1);
  font-size: 13.5px;
}

.guestbook-auth-card p {
  margin: 5px 0 0;
  color: var(--vp-c-text-3);
  font-size: 11.5px;
  line-height: 1.6;
}

.guestbook-auth-card .guestbook-submit {
  flex: 0 0 auto;
  margin: 0;
}

.guestbook-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 4%, var(--vp-c-bg));
}

.guestbook-identity__avatar {
  display: grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  place-items: center;
}

.guestbook-identity strong {
  display: block;
  color: var(--vp-c-text-1);
  font-size: 12.5px;
}

.guestbook-identity p {
  margin: 3px 0 0;
  color: var(--vp-c-text-3);
  font-size: 10.5px;
}

.guestbook-field {
  display: grid;
  gap: 6px;
}

.guestbook-field > span {
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 600;
}

.guestbook-field em {
  color: var(--vp-c-brand-1);
  font-style: normal;
}

.guestbook-field input,
.guestbook-field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--vp-c-divider);
  border-radius: 11px;
  outline: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 13.5px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.guestbook-field input {
  height: 40px;
  padding: 0 12px;
}

.guestbook-field textarea {
  min-height: 118px;
  padding: 11px 12px;
  line-height: 1.7;
  resize: vertical;
}

.guestbook-field input::placeholder,
.guestbook-field textarea::placeholder {
  color: var(--vp-c-text-3);
}

.guestbook-field input:focus,
.guestbook-field textarea:focus {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 55%, var(--vp-c-divider));
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
}

.guestbook-form__bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.guestbook-emojis {
  display: flex;
  gap: 4px;
}

.guestbook-emojis button {
  display: inline-grid;
  width: 27px;
  height: 27px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  place-items: center;
  transition: background 0.18s ease;
}

.guestbook-emojis button:hover {
  background: var(--vp-c-default-soft);
}

.guestbook-counter {
  margin-left: auto;
  color: var(--vp-c-text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.guestbook-submit {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  border: 0;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--vp-c-brand-1), color-mix(in srgb, var(--vp-c-brand-1) 72%, #4f8cf7));
  color: #fff;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.guestbook-submit:hover:not(:disabled) {
  box-shadow: 0 9px 22px color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
  transform: translateY(-1px);
}

.guestbook-submit:disabled {
  cursor: wait;
  opacity: 0.65;
}

.guestbook-form__error,
.guestbook-form__success {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
}

.guestbook-form__error {
  background: color-mix(in srgb, #ef4444 9%, transparent);
  color: #dc2626;
}

.guestbook-form__success {
  background: color-mix(in srgb, #22c55e 10%, transparent);
  color: #15803d;
}

.guestbook-reply-form__identity-note {
  padding: 8px 10px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 5%, var(--vp-c-bg));
  color: var(--vp-c-text-3);
  font-size: 11px;
}

.guestbook-reply-form__identity-note strong {
  color: var(--vp-c-text-2);
}

.guestbook-reply-form__login {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 5%, var(--vp-c-bg));
  color: var(--vp-c-text-3);
  font-size: 11px;
}

.guestbook-reply-form__login button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 650;
  cursor: pointer;
}

.guestbook-form__note {
  margin: 12px 0 0;
  color: var(--vp-c-text-3);
  font-size: 11px;
  line-height: 1.6;
}

.guestbook-wall {
  margin-top: 34px;
}

.guestbook-wall__head {
  display: flex;
  gap: 16px;
  align-items: end;
  justify-content: space-between;
  padding: 0 2px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.guestbook-wall__head .guestbook-eyebrow {
  margin-bottom: 5px;
}

.guestbook-wall__count {
  flex: 0 0 auto;
  padding-bottom: 3px;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.guestbook-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.guestbook-comment {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 13px;
  padding: 20px 2px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.guestbook-comment__avatar {
  display: grid;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(145deg, #8b7cf6, #5bb8f5);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  place-items: center;
}

.guestbook-comment__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.guestbook-comment__body {
  min-width: 0;
}

.guestbook-comment__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.guestbook-comment__nick {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  font-weight: 650;
}

.guestbook-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  align-items: center;
  margin-top: 4px;
  color: var(--vp-c-text-3);
  font-size: 11.5px;
  line-height: 1.55;
}

.guestbook-meta__item {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  overflow-wrap: anywhere;
}

.guestbook-meta__item--time {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.guestbook-meta__item + .guestbook-meta__item::before {
  content: "·";
  margin-right: 8px;
  color: color-mix(in srgb, var(--vp-c-text-3) 55%, transparent);
}

.guestbook-meta time {
  color: inherit;
  font-size: inherit;
}

.guestbook-meta--reply {
  gap: 2px 6px;
  margin-top: 3px;
  font-size: 10.5px;
}

.guestbook-meta--reply .guestbook-meta__item + .guestbook-meta__item::before {
  margin-right: 6px;
}

.guestbook-comment__text {
  margin: 6px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.guestbook-comment__text + .guestbook-comment__text {
  margin-top: 4px;
}

.guestbook-comment__nick a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed color-mix(in srgb, var(--vp-c-brand-1) 45%, transparent);
}

.guestbook-comment__nick a:hover {
  color: var(--vp-c-brand-1);
}

.guestbook-comment__content {
  min-width: 0;
}

.guestbook-comment__reply {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: var(--vp-c-text-3);
  font-size: 11.5px;
  cursor: pointer;
  transition: color 0.18s ease;
}

.guestbook-comment__reply:hover {
  color: var(--vp-c-brand-1);
}

.guestbook-replies {
  display: grid;
  gap: 14px;
  margin: 12px 0 0;
  padding: 12px 0 0 14px;
  border-left: 2px solid color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-divider));
  list-style: none;
}

.guestbook-reply {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
}

.guestbook-reply__avatar {
  display: grid;
  width: 28px;
  height: 28px;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(145deg, #8b7cf6, #5bb8f5);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  place-items: center;
}

.guestbook-reply__avatar img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.guestbook-reply__body {
  min-width: 0;
}

.guestbook-reply__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.guestbook-reply__nick {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--vp-c-text-1);
  font-size: 12.5px;
  font-weight: 650;
}

.guestbook-reply__nick a {
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent);
}

.guestbook-reply__nick a:hover {
  color: var(--vp-c-brand-1);
}

.guestbook-reply__to {
  color: var(--vp-c-text-3);
  font-size: 11.5px;
}

.guestbook-reply .guestbook-comment__text {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.7;
}

.guestbook-reply .guestbook-comment__image {
  max-width: min(100%, 240px);
}

.guestbook-reply-form {
  display: grid;
  gap: 9px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 24%, var(--vp-c-divider));
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}

.guestbook-reply-form__head {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  color: var(--vp-c-text-2);
  font-size: 12px;
}

.guestbook-reply-form__head strong {
  color: var(--vp-c-brand-1);
  font-weight: 650;
}

.guestbook-reply-form__head button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--vp-c-text-3);
  font-size: 11.5px;
  cursor: pointer;
}

.guestbook-reply-form__head button:hover {
  color: var(--vp-c-text-1);
}

.guestbook-reply-form__identity {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.guestbook-reply-form input,
.guestbook-reply-form textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  outline: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 12.5px;
}

.guestbook-reply-form input {
  height: 36px;
  padding: 0 10px;
}

.guestbook-reply-form textarea {
  min-height: 76px;
  padding: 9px 10px;
  line-height: 1.65;
  resize: vertical;
}

.guestbook-reply-form input::placeholder,
.guestbook-reply-form textarea::placeholder {
  color: var(--vp-c-text-3);
}

.guestbook-reply-form input:focus,
.guestbook-reply-form textarea:focus {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 55%, var(--vp-c-divider));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent);
}

.guestbook-reply-form__bottom {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.guestbook-reply-form__bottom > span {
  color: var(--vp-c-text-3);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.guestbook-reply-form__bottom button {
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.guestbook-reply-form__bottom button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.guestbook-reply-form .guestbook-form__error {
  margin: 0;
}

.guestbook-comment__image {
  display: block;
  max-width: min(100%, 300px);
  margin: 8px 0 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: zoom-in;
}

.guestbook-comment__image img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: cover;
  transition: transform 0.22s ease;
}

.guestbook-comment__image:hover img {
  transform: scale(1.015);
}



.guestbook-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.guestbook-attachment {
  position: relative;
  width: 64px;
  height: 64px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
}

.guestbook-attachment img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.guestbook-attachment > button {
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  width: 19px;
  height: 19px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.58);
  color: #fff;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  place-items: center;
}

.guestbook-attachment.is-uploading {
  display: grid;
  gap: 2px;
  color: var(--vp-c-text-3);
  font-size: 10px;
  place-items: center;
}

.guestbook-attachment.is-uploading span {
  font-size: 20px;
  line-height: 1;
}

.guestbook-image-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 27px;
  padding: 0 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 11.5px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease;
}

.guestbook-image-btn:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, var(--vp-c-divider));
  color: var(--vp-c-brand-1);
}

.guestbook-image-btn:disabled {
  cursor: wait;
  opacity: 0.55;
}

.guestbook-file {
  display: none;
}

.guestbook-lightbox {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  padding: 32px;
  background: rgba(10, 10, 14, 0.86);
  backdrop-filter: blur(4px);
  place-items: center;
}

.guestbook-lightbox img {
  max-width: min(92vw, 1000px);
  max-height: 86vh;
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
}

.guestbook-lightbox__close {
  position: absolute;
  top: 18px;
  right: 18px;
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  place-items: center;
}

.guestbook-state {
  padding: 46px 20px 42px;
  text-align: center;
}

.guestbook-state__icon {
  margin: 0 0 10px;
  color: color-mix(in srgb, var(--vp-c-brand-1) 65%, var(--vp-c-text-3));
  font-size: 30px;
  line-height: 1;
}

.guestbook-state__title {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 650;
}

.guestbook-state__desc {
  margin: 6px auto 0;
  max-width: 360px;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
  line-height: 1.7;
}

.guestbook-retry {
  margin-top: 14px;
  padding: 7px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 9px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}

.guestbook-skeleton {
  padding: 8px 0;
}

.guestbook-skeleton__row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 13px;
  padding: 18px 2px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.guestbook-skeleton__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--vp-c-default-soft);
  animation: guestbook-pulse 1.6s ease-in-out infinite;
}

.guestbook-skeleton__line {
  display: block;
  width: 100%;
  height: 10px;
  margin: 7px 0;
  border-radius: 5px;
  background: var(--vp-c-default-soft);
  animation: guestbook-pulse 1.6s ease-in-out infinite;
}

.guestbook-skeleton__line--short {
  width: 26%;
}

.guestbook-skeleton__line--medium {
  width: 72%;
}

@keyframes guestbook-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 0.9;
  }
}

@media (max-width: 900px) {
  .guestbook-top {
    grid-template-columns: minmax(0, 1fr);
  }

  .guestbook-side {
    order: 1;
  }

  .guestbook-form-card {
    order: 2;
  }
}

@media (max-width: 640px) {
  .guestbook-page {
    padding-bottom: 48px;
  }

  .guestbook-shell {
    padding: 0 16px;
  }

  .guestbook-hero {
    padding: 14px 0 24px;
  }

  .guestbook-hero__desc {
    font-size: 14px;
    line-height: 1.8;
  }

  .guestbook-side,
  .guestbook-form-card {
    padding: 18px;
    border-radius: 16px;
  }

  .guestbook-fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .guestbook-form__bottom {
    gap: 7px;
  }

  .guestbook-counter {
    order: 2;
    width: auto;
    margin-left: auto;
    text-align: right;
  }

  .guestbook-submit {
    order: 3;
    flex: 0 0 100%;
    width: 100%;
  }

  .guestbook-auth-card {
    flex-direction: column;
    align-items: stretch;
  }

  .guestbook-auth-card .guestbook-submit {
    width: 100%;
  }

  .guestbook-form__note {
    font-size: 10.5px;
  }

  .guestbook-wall {
    margin-top: 28px;
  }

  .guestbook-comment {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 11px;
    padding: 17px 1px;
  }

  .guestbook-comment__avatar {
    width: 34px;
    height: 34px;
    font-size: 13px;
  }

  .guestbook-comment__text {
    font-size: 13.5px;
  }

  .guestbook-comment__image {
    max-width: 100%;
  }

  .guestbook-attachment {
    width: 58px;
    height: 58px;
  }

  .guestbook-replies {
    padding-left: 10px;
  }

  .guestbook-reply {
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 8px;
  }

  .guestbook-reply__avatar {
    width: 26px;
    height: 26px;
    font-size: 10px;
  }

  .guestbook-reply-form {
    padding: 12px;
  }

  .guestbook-reply-form__identity {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 360px) {
  .guestbook-emojis button {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }

  .guestbook-emojis {
    flex-wrap: wrap;
  }
}
</style>
