<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { withBase, useData } from 'vitepress'
import { computed, nextTick, onMounted, ref } from 'vue'

type Moment = {
  /** 文件名（不含 .md），用作评论归属的稳定 ID */
  id: string
  /** 可选标题：仅当 frontmatter 显式写了 title 才显示 */
  title: string
  /** 时刻（HH:mm），日期部分由 day 承载 */
  time: string
  /** 分组键 yyyy-mm-dd；无法解析日期时为空串 */
  day: string
  /** 排序用时间戳，无日期时为 0（沉底） */
  ts: number
  /** 位置文字，显示在卡片底部 */
  location: string
  /** 图片列表，九宫格展示 */
  images: string[]
  /** 视频地址 */
  video: string
  /** 正文 Markdown（可空：纯图/纯视频贴） */
  content: string
  source: string
}

/** Twikoo COMMENT_GET 返回的评论里我们实际用到的字段 */
type TwikooComment = {
  id?: string
  nick?: string
  comment?: string
  created?: number
  master?: boolean
  isSpam?: boolean
}

type MomentComment = {
  id: string
  nick: string
  text: string
  created: number
  master: boolean
}

const props = withDefaults(
  defineProps<{
    /** 封面图，默认复用首页 Banner 背景 */
    cover?: string
    /** 头像，默认用站点头像 */
    avatar?: string
    /** 昵称 */
    name?: string
    /** 签名，留空则取页面 frontmatter.desc */
    signature?: string
  }>(),
  {
    cover: '',
    avatar: '/logo.png',
    name: 'weno',
    signature: '',
  },
)

const { frontmatter, theme } = useData()

// glob 以 Vite root（即 docs/）为根；?raw 拿原文，frontmatter 在此自行解析，
// 从而绕开 VitePress 的 md 转换 —— 碎片文件不生成独立页面，只作为数据被聚合
const sources = import.meta.glob('/04.随笔/02.moments/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
})

/**
 * frontmatter 子集解析：只覆盖动态元数据需要的形态 ——
 *   标量（可带引号）、行内列表 images: [a, b]、块列表（key: 换行 - 项）。
 * 不支持嵌套、锚点、多行文本；动态字段用不到这些。
 */
const parseScalar = (value: string) => {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const parseInlineList = (value: string) => {
  const trimmed = value.trim()
  return trimmed
    .slice(1, -1)
    .split(',')
    .map(parseScalar)
    .filter(Boolean)
}

const parseFrontmatter = (raw: string) => {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (!match) return { data: {} as Record<string, string | string[]>, body: raw }

  const data: Record<string, string | string[]> = {}
  // listKey 记录「key: 空值」开启的块列表，随后缩进的 - 项归入该键
  let listKey: string | null = null

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s*(.+)$/)
    if (listItem && listKey && Array.isArray(data[listKey])) {
      data[listKey].push(parseScalar(listItem[1]))
      continue
    }
    const entry = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!entry) {
      listKey = null
      continue
    }
    const [, key, rawValue] = entry
    const trimmedValue = rawValue.trim()
    if (trimmedValue === '') {
      data[key] = []
      listKey = key
    } else if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
      data[key] = parseInlineList(rawValue)
      listKey = null
    } else {
      data[key] = parseScalar(rawValue)
      listKey = null
    }
  }
  return { data, body: raw.slice(match[0].length) }
}

const asList = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value
  return typeof value === 'string' && value ? [value] : []
}

const asScalar = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value : ''

const parseMoment = (source: string, raw: string): Moment | null => {
  const filename = source.split('/').pop() ?? ''
  // 目录内的 README.md 是写字段的说明文档，不是动态
  if (/^readme\.md$/i.test(filename)) return null

  const { data, body } = parseFrontmatter(raw)
  const text = body.trim()
  const images = asList(data.images)
  const video = asScalar(data.video)

  // visible: false（不区分大小写）隐藏，缺省显示
  if (asScalar(data.visible).toLowerCase() === 'false') return null
  // 正文、图片、视频全空则视为空文件跳过
  if (!text && !images.length && !video) return null

  // auto-frontmatter 插件会往缺字段的 md 里注入 title: <文件名>，
  // 这类与文件名相同的标题视为未写标题，避免卡片顶着文件名
  const rawTitle = asScalar(data.title)
  const title = rawTitle === filename.replace(/\.md$/, '') ? '' : rawTitle

  // date 支持只写到日期，也可精确到秒；缺省回退文件名开头的日期前缀。
  // day/time 直接取自字符串；ts 仅用于排序（各条统一换算，相对次序不受时区影响）
  const rawDate = asScalar(data.date) || filename.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''
  const timeMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}[T ](\d{1,2}):(\d{2})/)
  const parsed = rawDate ? new Date(rawDate.replace(' ', 'T')) : null
  const valid = parsed !== null && !Number.isNaN(parsed.getTime())

  return {
    id: filename.replace(/\.md$/i, ''),
    title,
    time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '',
    day: valid ? rawDate.slice(0, 10) : rawDate,
    ts: valid ? parsed.getTime() : 0,
    location: asScalar(data.location),
    images,
    video,
    content: text,
    source,
  }
}

const moments = computed(() =>
  Object.entries(sources)
    .map(([source, raw]) => parseMoment(source, raw))
    .filter((moment): moment is Moment => moment !== null)
    .sort((a, b) => b.ts - a.ts || b.source.localeCompare(a.source)),
)

const render = (content: string) => markdown.render(content)

/** 朋友圈式九宫格：1 张自然比例；2/4 张两列；3+ 张三列 */
const imageLayout = (count: number) =>
  count === 1
    ? 'moment-images--1'
    : count === 2 || count === 4
      ? 'moment-images--2'
      : 'moment-images--3'

/** 本地 `/` 路径在 GitHub Pages 子路径部署时需要补 base */
const assetUrl = (value: string) => (/^https?:\/\//.test(value) ? value : withBase(value))

// 封面默认复用首页 Banner 背景。不能直接 import site.ts：那里用了
// process.env，会被打进客户端导致 “process is not defined”，
// 因此从运行时 theme 配置里取 banner.imgSrc（构建期已解析成字符串）。
const themeCover = computed(() => {
  const banner = (theme.value as { banner?: { imgSrc?: unknown } }).banner
  const imgSrc = banner?.imgSrc
  if (typeof imgSrc === 'string') return imgSrc
  if (Array.isArray(imgSrc) && typeof imgSrc[0] === 'string') return imgSrc[0]
  return ''
})

const coverSrc = computed(() =>
  assetUrl(props.cover || String(frontmatter.value.cover || themeCover.value)),
)
const pageTitle = computed(() => String(frontmatter.value.title || '朋友圈'))
const coverFailed = ref(false)
const avatarSrc = computed(() => assetUrl(props.avatar))
const signatureText = computed(
  () =>
    props.signature ||
    String(frontmatter.value.signature || frontmatter.value.desc || '零星的岛屿也能找到海'),
)

const formatMomentTime = (moment: Moment) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moment.day)) return moment.time || moment.day
  const [, month, date] = moment.day.split('-')
  const label = `${Number(month)}月${Number(date)}日`
  return moment.time ? `${label} ${moment.time}` : label
}

const momentDateTime = (moment: Moment) =>
  moment.day ? `${moment.day}T${moment.time || '00:00'}` : undefined

// ---------------------------------------------------------------------------
// 点赞：按产品确认，点赞仅保存在本机 localStorage，不改动评论后端
// ---------------------------------------------------------------------------
const LIKE_STORAGE_KEY = 'moments-likes-v1'
const likedIds = ref<Record<string, boolean>>({})

const loadLikes = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LIKE_STORAGE_KEY) || '{}')
    if (raw && typeof raw === 'object') likedIds.value = raw as Record<string, boolean>
  } catch {
    // 隐私模式 / 禁用存储时静默降级为仅内存点赞
  }
}

const isLiked = (id: string) => Boolean(likedIds.value[id])

const toggleLike = (moment: Moment) => {
  const next = !isLiked(moment.id)
  likedIds.value = { ...likedIds.value, [moment.id]: next }
  try {
    localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(likedIds.value))
  } catch {
    // 忽略存储失败，本次会话内仍然生效
  }
}

// ---------------------------------------------------------------------------
// 评论：直接使用站点已有的 Twikoo 后端，但用朋友圈自己的评论 UI 渲染。
//
// 所有评论落在同一个 Twikoo 页面路径 /moments 下，评论正文用 [[moment:<id>]]
// 前缀标记归属，这样只需一次 COMMENT_GET 就能拿到全站朋友圈评论，避免每条
// 朋友圈各发一次请求。提交时同样带上前缀，前端渲染前会剥掉。
// ---------------------------------------------------------------------------
const MOMENTS_COMMENT_PATH = '/moments'
/**
 * 线上评论服务地址。正常构建会从 teekConfig.comment.options.envId 注入；
 * 本地 .env 没有该变量时回退到这里，保证 dev 下也能联调评论。
 */
const FALLBACK_TWIKOO_ENDPOINT = 'https://comments.lovetulin.cn'
const TWIKOO_TOKEN_KEY = 'moments-twikoo-token'
const NICKNAME_KEY = 'moments-nickname'
const COMMENT_MARKER_RE = /^\[\[moment:([^\]]+)\]\]\s*/

const twikooEndpoint = computed(() => {
  const comment = (theme.value as {
    comment?: { options?: { envId?: string } }
  }).comment
  const envId = comment?.options?.envId
  return typeof envId === 'string' && envId ? envId : FALLBACK_TWIKOO_ENDPOINT
})

let accessToken = ''
let configReady = false

const readAccessToken = () => {
  if (accessToken) return accessToken
  try {
    accessToken = localStorage.getItem(TWIKOO_TOKEN_KEY) || ''
  } catch {
    // ignore
  }
  return accessToken
}

const twikooCall = async (
  event: string,
  payload: Record<string, unknown> = {},
): Promise<{
  code?: number
  message?: string
  accessToken?: string
  id?: string
  data?: TwikooComment[]
}> => {
  const endpoint = twikooEndpoint.value
  if (!/^https?:\/\//.test(endpoint)) {
    throw new Error('评论服务未配置')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      envId: endpoint,
      accessToken: readAccessToken(),
      ...payload,
    }),
  })

  if (!response.ok) {
    throw new Error(`评论服务返回 ${response.status}`)
  }

  const result = (await response.json()) as {
    code?: number
    message?: string
    accessToken?: string
    data?: TwikooComment[]
  }

  if (typeof result.accessToken === 'string' && result.accessToken) {
    accessToken = result.accessToken
    try {
      localStorage.setItem(TWIKOO_TOKEN_KEY, accessToken)
    } catch {
      // ignore
    }
  }

  if (typeof result.code === 'number' && result.code !== 0) {
    throw new Error(result.message || '评论服务暂不可用')
  }

  return result
}

const ensureConfig = async () => {
  if (configReady) return
  await twikooCall('GET_CONFIG')
  configReady = true
}

const commentsByMoment = ref<Record<string, MomentComment[]>>({})
const commentsError = ref('')

const commentsFor = (id: string) => commentsByMoment.value[id] ?? []
const commentCount = (id: string) => commentsFor(id).length

const loadComments = async () => {
  commentsError.value = ''
  try {
    await ensureConfig()
    const result = await twikooCall('COMMENT_GET', {
      url: MOMENTS_COMMENT_PATH,
      sort: 'newest',
      keyword: '',
      pageSize: 500,
    })

    const grouped: Record<string, MomentComment[]> = {}
    const seen = new Set<string>()

    for (const raw of result.data ?? []) {
      if (raw.isSpam) continue
      const rawText = String(raw.comment || '')
      const marker = rawText.match(COMMENT_MARKER_RE)
      if (!marker) continue

      const momentId = marker[1]
      const text = rawText.slice(marker[0].length).trim()
      if (!text) continue

      const key = String(raw.id || `${momentId}-${raw.created || 0}-${raw.nick || ''}`)
      if (seen.has(key)) continue
      seen.add(key)

      if (!grouped[momentId]) grouped[momentId] = []
      grouped[momentId].push({
        id: key,
        nick: String(raw.nick || '访客'),
        text,
        created: Number(raw.created) || 0,
        master: Boolean(raw.master),
      })
    }

    Object.values(grouped).forEach((list) => list.sort((a, b) => a.created - b.created))
    commentsByMoment.value = grouped
  } catch (error) {
    commentsError.value = error instanceof Error ? error.message : '评论加载失败'
  }
}

// ---------------------------------------------------------------------------
// 评论输入
// ---------------------------------------------------------------------------
const composerId = ref<string | null>(null)
const composerText = ref('')
const nickname = ref('')
const submittingId = ref('')
const composerError = ref('')
const composerTextInput = ref<HTMLInputElement | null>(null)
const composerNickInput = ref<HTMLInputElement | null>(null)
const setComposerText = (el: unknown) => { composerTextInput.value = (el as HTMLInputElement | null) ?? null }
const setComposerNick = (el: unknown) => { composerNickInput.value = (el as HTMLInputElement | null) ?? null }

const openComposer = async (moment: Moment) => {
  composerId.value = moment.id
  composerText.value = ''
  composerError.value = ''
  if (!nickname.value) {
    try {
      nickname.value = localStorage.getItem(NICKNAME_KEY) || ''
    } catch {
      // ignore
    }
  }
  await nextTick()
  if (!nickname.value) composerNickInput.value?.focus()
  else composerTextInput.value?.focus()
}

const closeComposer = () => {
  composerId.value = null
  composerError.value = ''
}

const saveNickname = (value: string) => {
  try {
    localStorage.setItem(NICKNAME_KEY, value)
  } catch {
    // ignore
  }
}

const submitComment = async (moment: Moment) => {
  if (submittingId.value) return

  const text = composerText.value.trim()
  const nick = nickname.value.trim()

  if (!nick) {
    composerError.value = '请先填写昵称'
    return
  }
  if (!text) {
    composerError.value = '写点什么再发送吧'
    return
  }

  submittingId.value = moment.id
  composerError.value = ''

  try {
    await ensureConfig()
    const result = await twikooCall('COMMENT_SUBMIT', {
      url: MOMENTS_COMMENT_PATH,
      nick,
      mail: '',
      comment: `[[moment:${moment.id}]] ${text}`,
      ua: navigator.userAgent,
    })

    // 先乐观插入，避免评论服务刷新稍慢时输入框关闭却看不到新评论
    const optimistic: MomentComment = {
      id: String(result.id || `local-${Date.now()}`),
      nick,
      text,
      created: Date.now(),
      master: false,
    }
    commentsByMoment.value = {
      ...commentsByMoment.value,
      [moment.id]: [...commentsFor(moment.id), optimistic],
    }
    saveNickname(nick)
    composerText.value = ''
    composerId.value = null
    void loadComments()
  } catch (error) {
    composerError.value = error instanceof Error ? error.message : '发送失败，请稍后重试'
  } finally {
    submittingId.value = ''
  }
}

const lightbox = ref<string | null>(null)

onMounted(() => {
  loadLikes()
  try {
    nickname.value = localStorage.getItem(NICKNAME_KEY) || ''
  } catch {
    // ignore
  }
  void loadComments()
})
</script>

<template>
  <section class="moments-timeline" aria-label="朋友圈">
    <h1 class="moments-sr-only">{{ pageTitle }}</h1>

    <header class="moments-header">
      <div class="moments-cover">
        <img
          v-if="coverSrc && !coverFailed"
          :src="coverSrc"
          alt=""
          fetchpriority="high"
          decoding="async"
          @error="coverFailed = true"
        />
        <img
          v-else-if="coverFailed"
          class="moments-cover__fallback"
          :src="assetUrl('/tx.jpg')"
          alt=""
          decoding="async"
        />
      </div>
      <div class="moments-profile">
        <div class="moments-profile__text">
          <p class="moments-name">{{ props.name }}</p>
          <p class="moments-signature">{{ signatureText }}</p>
        </div>
        <img class="moments-avatar" :src="avatarSrc" :alt="`${props.name} 的头像`" />
      </div>
    </header>

    <div class="moments-feed-head">
      <span>{{ pageTitle }}</span>
      <span class="moments-feed-head__meta">
        {{ moments.length }} 条动态
      </span>
    </div>

    <p v-if="commentsError" class="moments-alert" role="status">
      评论暂时加载失败：{{ commentsError }}
      <button type="button" @click="loadComments">重试</button>
    </p>

    <div v-if="!moments.length" class="moments-empty">
      还没有动态。新建一个 Markdown 文件放入本目录，重新构建后就会自动出现在这里。
    </div>

    <article v-for="moment in moments" :key="moment.source" class="moment">
      <img class="moment-avatar" :src="avatarSrc" alt="" loading="lazy" />

      <div class="moment-body">
        <p class="moment-name">{{ props.name }}</p>

        <h2 v-if="moment.title" class="moment-title">{{ moment.title }}</h2>
        <div v-if="moment.content" class="moment-content" v-html="render(moment.content)"></div>

        <div
          v-if="moment.images.length"
          class="moment-images"
          :class="imageLayout(moment.images.length)"
        >
          <button
            v-for="image in moment.images"
            :key="image"
            type="button"
            class="moment-image"
            :aria-label="`查看图片 ${image}`"
            @click="lightbox = assetUrl(image)"
          >
            <img :src="assetUrl(image)" alt="" loading="lazy" decoding="async" />
          </button>
        </div>

        <video
          v-if="moment.video"
          class="moment-video"
          controls
          preload="metadata"
          :src="assetUrl(moment.video)"
        ></video>

        <div class="moment-footer">
          <div class="moment-meta">
            <time v-if="moment.time || moment.day" :datetime="momentDateTime(moment)">
              {{ formatMomentTime(moment) }}
            </time>
            <p v-if="moment.location" class="moment-location" :title="moment.location">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{{ moment.location }}</span>
            </p>
          </div>

          <div class="moment-actions">
            <button
              type="button"
              class="moment-action"
              :class="{ 'is-liked': isLiked(moment.id) }"
              :aria-pressed="isLiked(moment.id)"
              :aria-label="isLiked(moment.id) ? '取消点赞' : '点赞'"
              :title="isLiked(moment.id) ? '取消点赞（仅本机）' : '点赞（仅本机保存）'"
              @click="toggleLike(moment)"
            >
              <svg class="moment-action__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.7 4.8 13.5a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l.4.4.4-.4a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8L12 20.7Z"
                />
              </svg>
              <span>{{ isLiked(moment.id) ? '已赞' : '赞' }}</span>
            </button>

            <button
              type="button"
              class="moment-action"
              aria-label="评论"
              @click="openComposer(moment)"
            >
              <svg class="moment-action__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 5.8A2.8 2.8 0 0 1 6.8 3h10.4A2.8 2.8 0 0 1 20 5.8v8.4a2.8 2.8 0 0 1-2.8 2.8H9.4l-4 3.2a.8.8 0 0 1-1.3-.6v-2.8A2.8 2.8 0 0 1 4 14.2V5.8Z"
                />
              </svg>
              <span>评论</span>
              <span v-if="commentCount(moment.id)" class="moment-action__count">
                {{ commentCount(moment.id) }}
              </span>
            </button>
          </div>
        </div>

        <div
          v-if="isLiked(moment.id) || commentsFor(moment.id).length"
          class="moment-interactions"
        >
          <div v-if="isLiked(moment.id)" class="moment-likes">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 20.7 4.8 13.5a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l.4.4.4-.4a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8L12 20.7Z"
              />
            </svg>
            <span>我</span>
          </div>

          <ul v-if="commentsFor(moment.id).length" class="moment-comments" aria-label="评论">
            <li v-for="comment in commentsFor(moment.id)" :key="comment.id" class="moment-comment">
              <span class="moment-comment__name">{{ comment.nick }}</span>
              <span v-if="comment.master" class="moment-comment__master">博主</span>
              <span class="moment-comment__sep">：</span>
              <span class="moment-comment__text">{{ comment.text }}</span>
            </li>
          </ul>
        </div>

        <form v-if="composerId === moment.id" class="moment-composer" @submit.prevent="submitComment(moment)">
          <div class="moment-composer__row">
            <input
              v-model="nickname"
              :ref="setComposerNick"
              class="moment-composer__nick"
              type="text"
              maxlength="20"
              placeholder="昵称"
              aria-label="昵称"
            />
            <input
              :ref="setComposerText"
              v-model="composerText"
              class="moment-composer__text"
              type="text"
              maxlength="500"
              :placeholder="`评论 ${props.name}…`"
              aria-label="评论内容"
            />
            <button
              type="submit"
              class="moment-composer__send"
              :disabled="submittingId === moment.id"
            >
              {{ submittingId === moment.id ? '发送中' : '发送' }}
            </button>
          </div>
          <div class="moment-composer__foot">
            <span v-if="composerError" class="moment-composer__error">{{ composerError }}</span>
            <button type="button" class="moment-composer__cancel" @click="closeComposer">
              取消
            </button>
          </div>
        </form>
      </div>
    </article>

    <p v-if="moments.length" class="moments-end">没有更多了</p>

    <Teleport to="body">
      <div
        v-if="lightbox"
        class="moment-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="查看图片"
        @click="lightbox = null"
      >
        <img :src="lightbox" alt="" />
        <button type="button" class="moment-lightbox__close" aria-label="关闭" @click.stop="lightbox = null">
          ×
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.moments-timeline {
  --moments-name-color: #576b95;
  --moments-liked-color: #e64340;
  position: relative;
  max-width: 44rem;
  margin: 0 auto;
  padding: 20px 16px 48px;
}

.moments-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(.dark) .moments-timeline {
  --moments-name-color: #8ab4f8;
  --moments-liked-color: #ff7b72;
}

/* 封面与个人资料：仿微信朋友圈的「封面 + 右下角头像」结构 */
.moments-cover {
  position: relative;
  height: 210px;
  overflow: hidden;
  border-radius: 12px;
  background:
    radial-gradient(circle at 20% 20%, rgba(113, 102, 240, 0.35), transparent 45%),
    linear-gradient(135deg, #1f2937, #4b5563);
}

.moments-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.moments-cover__fallback {
  object-position: center 32%;
}

.moments-profile {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 0 10px;
}

.moments-profile__text {
  flex: 1;
  min-width: 0;
  padding-top: 10px;
}

.moments-name {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.moments-signature {
  margin: 4px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.5;
}

.moments-avatar {
  position: relative;
  z-index: 2;
  flex: none;
  width: 76px;
  height: 76px;
  margin-top: -34px;
  border: 3px solid var(--vp-c-bg);
  border-radius: 10px;
  background: var(--vp-c-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.16);
  object-fit: cover;
}

.moments-feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.moments-feed-head__meta {
  color: var(--vp-c-text-3);
  font-weight: 400;
  letter-spacing: 0;
}

.moments-alert {
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--vp-c-danger-2);
  border-radius: 8px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-size: 13px;
  line-height: 1.5;
}

.moments-alert button {
  margin-left: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.moments-empty {
  margin-top: 16px;
  padding: 32px 16px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 12px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  text-align: center;
}

/* 动态：左头像 + 右内容，分隔线而不是卡片，贴近微信朋友圈 */
.moment {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.moment:last-of-type {
  border-bottom: 0;
}

.moment-avatar {
  flex: none;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  object-fit: cover;
}

.moment-body {
  flex: 1;
  min-width: 0;
}

.moment-name {
  margin: 0;
  color: var(--moments-name-color);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.4;
}

.moment-title {
  margin: 4px 0 0;
  border-top: 0;
  color: var(--vp-c-text-1);
  font-size: 16.5px;
  font-weight: 600;
  line-height: 1.5;
}

.moment-content {
  margin-top: 4px;
  color: var(--vp-c-text-1);
  font-size: 15px;
  line-height: 1.75;
  letter-spacing: 0.01em;
  overflow-wrap: anywhere;
}

.moment-content :deep(p) {
  margin: 0.45em 0;
}

.moment-content :deep(:first-child) {
  margin-top: 0;
}

.moment-content :deep(:last-child) {
  margin-bottom: 0;
}

.moment-content :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}

.moment-content :deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

@media (hover: hover) {
  .moment-content :deep(a:hover) {
    text-decoration: underline;
  }
}

.moment-images {
  display: grid;
  gap: 4px;
  width: min(100%, 22rem);
  margin-top: 8px;
}

.moment-images--1 {
  grid-template-columns: minmax(0, 18rem);
}

.moment-images--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.moment-images--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.moment-image {
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  overflow: hidden;
  border-radius: 4px;
}

.moment-images--2 .moment-image,
.moment-images--3 .moment-image {
  aspect-ratio: 1;
}

.moment-image img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  object-fit: cover;
  transition: transform 0.25s ease;
}

@media (hover: hover) {
  .moment-image:hover img {
    transform: scale(1.04);
  }
}

.moment-image:active img {
  transform: scale(0.96);
}

.moment-images--1 .moment-image img {
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 22rem;
  object-fit: cover;
}

.moment-video {
  display: block;
  width: 100%;
  max-width: 26rem;
  margin-top: 8px;
  border-radius: 4px;
  background: #000;
}

.moment-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  color: var(--vp-c-text-3);
  font-size: 12.5px;
}

.moment-meta {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
}

.moment-meta time {
  flex: none;
  white-space: nowrap;
}

.moment-location {
  display: flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  min-width: 0;
  margin: 0;
  color: var(--moments-name-color);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.moment-location svg {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.moment-location span {
  min-width: 0;
}

.moment-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.moment-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--moments-name-color);
  font: inherit;
  font-size: 12.5px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.moment-action:hover {
  background: var(--vp-c-default-soft);
}

.moment-action.is-liked {
  color: var(--moments-liked-color);
}

.moment-action__icon {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.moment-action.is-liked .moment-action__icon {
  fill: currentColor;
  animation: moment-heart-pop 0.28s ease;
}

.moment-action__count {
  color: var(--vp-c-text-3);
  font-size: 11px;
}

@keyframes moment-heart-pop {
  0% {
    transform: scale(0.72);
  }
  60% {
    transform: scale(1.16);
  }
  100% {
    transform: scale(1);
  }
}

/* 点赞/评论块：灰底小气泡，顶部有一个指向操作区的小三角 */
.moment-interactions {
  position: relative;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  line-height: 1.65;
}

.moment-interactions::before {
  position: absolute;
  top: -4px;
  left: 14px;
  width: 9px;
  height: 9px;
  background: var(--vp-c-bg-soft);
  content: '';
  transform: rotate(45deg);
}

.moment-likes {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--moments-name-color);
}

.moment-likes svg {
  width: 14px;
  height: 14px;
  fill: var(--moments-liked-color);
}

.moment-likes + .moment-comments {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--vp-c-divider);
}

.moment-comments {
  margin: 0;
  padding: 0;
  list-style: none;
}

.moment-comment {
  margin: 1px 0;
  color: var(--vp-c-text-1);
  overflow-wrap: anywhere;
}

.moment-comment__name {
  color: var(--moments-name-color);
  font-weight: 600;
}

.moment-comment__master {
  display: inline-block;
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  vertical-align: 1px;
}

.moment-comment__sep {
  color: var(--vp-c-text-2);
}

.moment-comment__text {
  white-space: pre-wrap;
}

.moment-composer {
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.moment-composer__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.moment-composer__nick,
.moment-composer__text {
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  outline: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.2s ease;
}

.moment-composer__nick:focus,
.moment-composer__text:focus {
  border-color: var(--vp-c-brand-1);
}

.moment-composer__nick {
  flex: 0 0 76px;
  width: 76px;
}

.moment-composer__text {
  flex: 1 1 auto;
}

.moment-composer__send {
  flex: none;
  min-height: 30px;
  padding: 5px 12px;
  border: 0;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.moment-composer__send:disabled {
  cursor: wait;
  opacity: 0.6;
}

.moment-composer__foot {
  display: flex;
  align-items: center;
  min-height: 18px;
  margin-top: 4px;
  font-size: 12px;
}

.moment-composer__error {
  color: var(--vp-c-danger-1);
}

.moment-composer__cancel {
  margin-left: auto;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--vp-c-text-2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.moments-end {
  margin: 24px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-align: center;
}

.moment-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.82);
  cursor: zoom-out;
}

.moment-lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 6px;
}

.moment-lightbox__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 24px;
  line-height: 40px;
  cursor: pointer;
}

@media (max-width: 640px) {
  .moments-timeline {
    padding: 14px 12px 40px;
  }

  .moments-cover {
    height: 160px;
    border-radius: 10px;
  }

  .moments-avatar {
    width: 64px;
    height: 64px;
    margin-top: -30px;
    border-width: 3px;
    border-radius: 8px;
  }

  .moments-name {
    font-size: 20px;
  }

  .moments-profile {
    gap: 10px;
    padding: 0 6px;
  }

  .moments-feed-head {
    margin-top: 20px;
  }

  .moment {
    gap: 10px;
    padding: 12px 0;
  }

  .moment-avatar {
    width: 40px;
    height: 40px;
  }

  .moment-title {
    font-size: 15.5px;
  }

  .moment-content {
    font-size: 14.5px;
    line-height: 1.72;
  }

  .moment-footer {
    font-size: 12px;
  }

  .moment-location {
    max-width: 100%;
  }

  .moment-action {
    min-height: 30px;
    padding: 5px 5px;
  }

  .moment-composer__nick {
    flex-basis: 66px;
    width: 66px;
  }

  .moment-composer__send {
    padding: 5px 10px;
  }

  .moment-lightbox {
    padding: 1rem;
  }
}

@media (max-width: 360px) {
  .moment-composer__row {
    flex-wrap: wrap;
  }

  .moment-composer__text {
    flex-basis: calc(100% - 72px);
  }

  .moment-composer__send {
    margin-left: auto;
  }
}
</style>
