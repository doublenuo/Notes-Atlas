<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed, ref } from 'vue'

type Moment = {
  /** 可选标题：仅当 frontmatter 显式写了 title 才显示 */
  title: string
  /** 时刻（HH:mm），日期部分由 day 承载 */
  time: string
  /** 分组键 yyyy-mm-dd；无法解析日期时为空串（该条不进日期分组头） */
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

type MomentGroup = { day: string; label: string; items: Moment[] }

const props = withDefaults(
  defineProps<{
    /** 卡片头像，默认用站点头像 */
    avatar?: string
    /** 卡片昵称 */
    name?: string
  }>(),
  { avatar: '/tx.jpg', name: 'weno' },
)

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

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

// 日期一律按「墙上时间」处理（不做时区换算）：分组、时刻直接取自字符串，
// 否则构建机时区（如 CI 的 UTC）与作者本地时间相差数小时会导致分组跨天。
// 星期几由 T00:00 本地解析得到——同一日期串在任何时区下星期一致
const formatDayLabel = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  const [year, month, date] = day.split('-')
  const weekday = new Date(`${day}T00:00:00`).getDay()
  if (Number.isNaN(weekday)) return day
  return `${year}年${Number(month)}月${Number(date)}日 · 周${WEEKDAY_LABELS[weekday]}`
}

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

const groups = computed<MomentGroup[]>(() => {
  const out: MomentGroup[] = []
  for (const moment of moments.value) {
    const last = out[out.length - 1]
    if (last && last.day === moment.day) {
      last.items.push(moment)
    } else {
      out.push({ day: moment.day, label: formatDayLabel(moment.day), items: [moment] })
    }
  }
  return out
})

const render = (content: string) => markdown.render(content)

/** 朋友圈式九宫格：1 张自然比例，2 张两列，≥3 张三列 */
const imageLayout = (count: number) =>
  count === 1 ? 'moment-images--1' : count === 2 ? 'moment-images--2' : 'moment-images--3'

const lightbox = ref<string | null>(null)
</script>

<template>
  <section class="moments-timeline" aria-label="朋友圈动态">
    <div v-if="!groups.length" class="moments-empty">
      还没有动态。新建一个 Markdown 文件放入本目录，重新构建后就会自动出现在这里。
    </div>

    <div v-for="group in groups" :key="group.day || group.label" class="moment-group">
      <div v-if="group.label" class="moment-divider">
        <time v-if="group.day" :datetime="group.day">{{ group.label }}</time>
        <span v-else>{{ group.label }}</span>
      </div>

      <article v-for="moment in group.items" :key="moment.source" class="moment">
        <img class="moment-avatar" :src="props.avatar" alt="" loading="lazy" />
        <div class="moment-card">
          <header class="moment-head">
            <span class="moment-name">{{ props.name }}</span>
            <time v-if="moment.time" class="moment-time">{{ moment.time }}</time>
          </header>
          <h3 v-if="moment.title" class="moment-title">{{ moment.title }}</h3>
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
              @click="lightbox = image"
            >
              <img :src="image" alt="" loading="lazy" />
            </button>
          </div>

          <video
            v-if="moment.video"
            class="moment-video"
            controls
            preload="metadata"
            :src="moment.video"
          ></video>

          <p v-if="moment.location" class="moment-location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{{ moment.location }}</span>
          </p>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="lightbox"
        class="moment-lightbox"
        role="dialog"
        aria-label="查看图片"
        @click="lightbox = null"
      >
        <img :src="lightbox" alt="" />
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.moments-timeline {
  position: relative;
  margin: 2rem 0;
  padding: 0.25rem 0 0.25rem 1.75rem;
}

.moments-timeline::before {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  left: 0.4rem;
  width: 2px;
  border-radius: 1px;
  background: var(--vp-c-divider);
  content: "";
}

.moment-group + .moment-group {
  margin-top: 1.25rem;
}

.moment-divider {
  position: relative;
  margin: 0 0 1rem;
}

.moment-divider time,
.moment-divider span {
  display: inline-block;
  padding: 0.2rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
  font-weight: 500;
}

.moment {
  display: flex;
  gap: 0.75rem;
  margin: 0 0 1rem;
}

.moment:last-child {
  margin-bottom: 0;
}

.moment-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  object-fit: cover;
}

.moment-card {
  flex: 1;
  min-width: 0;
  padding: 0.85rem 1.1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.85rem;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s ease;
}

/* hover 效果只给真指针设备，触屏设备不产生粘滞高亮 */
@media (hover: hover) {
  .moment-card:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.moment-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.moment-name {
  font-size: 0.92rem;
  font-weight: 600;
}

.moment-time {
  margin-left: auto;
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
  white-space: nowrap;
}

.moment-title {
  margin: 0.55rem 0 0;
  border-top: 0;
  font-size: 1.02rem;
  font-weight: 600;
  line-height: 1.5;
}

.moment-content {
  margin-top: 0.4rem;
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  line-height: 1.75;
  /* 长链接在窄屏卡片里也能折行，不撑破布局 */
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
  border-radius: 0.6rem;
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
  gap: 0.3rem;
  margin-top: 0.55rem;
}

.moment-images--1 {
  grid-template-columns: minmax(0, 20rem);
}

.moment-images--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 22rem;
}

.moment-images--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-width: 28rem;
}

.moment-image {
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  overflow: hidden;
  border-radius: 0.5rem;
}

.moment-images--2 .moment-image,
.moment-images--3 .moment-image {
  aspect-ratio: 1;
}

.moment-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0.5rem;
  transition: transform 0.25s ease;
}

@media (hover: hover) {
  .moment-image:hover img {
    transform: scale(1.04);
  }
}

/* 触屏按压反馈 */
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
  margin-top: 0.55rem;
  border-radius: 0.6rem;
  background: #000;
}

.moment-location {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0.6rem 0 0;
  color: var(--vp-c-brand-1);
  font-size: 0.85rem;
}

.moment-location svg {
  width: 1em;
  height: 1em;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
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
  border-radius: 0.5rem;
}

.moments-empty {
  padding: 1.5rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 0.85rem;
  color: var(--vp-c-text-2);
  text-align: center;
}

@media (max-width: 640px) {
  .moments-timeline {
    padding-left: 1.5rem;
  }

  .moment {
    gap: 0.6rem;
  }

  .moment-avatar {
    width: 34px;
    height: 34px;
  }

  .moment-card {
    padding: 0.7rem 0.9rem;
  }

  .moment-lightbox {
    padding: 1rem;
  }
}
</style>
