import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

/**
 * 全站 permalink 路由 + 侧边栏生成。
 *
 * 背景：VitePress 1.6.4 本身不认 frontmatter 的 `permalink`（其源码里 27 处
 * permalink 全部属于 markdown-it-anchor 的锚点选项），页面只会按源文件路径产出
 * HTML。结果是 /materials/meet/20260929 这类 permalink 在磁盘上没有文件、硬刷新必 404。
 * 这里用 VitePress 原生的 `rewrites` 把 URL 落地，同时生成配套的 sidebar。
 *
 * URL 规则：
 *   1. 有 frontmatter.permalink → 直接采用（这是作者的显式意图，最高优先）
 *   2. 没有 → 用文档标题派生 slug，并挂在其所属分区的前缀下
 *      （不分区分会把 98 个中文标题页全倒进根命名空间，和 /about /archives 混在一起）
 *
 * 侧边栏：VitePress 的 getSidebar 按「当前路径最长前缀」匹配 sidebar 键，所以键
 * 必须是 permalink 前缀（/materials/ /study/ /tools/）。teek 自带的
 * vitepress-plugin-sidebar-resolve 是按**磁盘目录名**生成键的，一旦开启 rewrites
 * 页面 URL 就和它的键对不上，全站侧边栏会变空白 —— 故此处关掉 teek 的 sidebar，
 * 改为按目录树自行生成，链接指向 permalink。
 */

/** 磁盘顶层目录 → URL 顶层段。@pages 下都是单段 permalink，不需要前缀。 */
const SECTION_PREFIX: Record<string, string> = {
  '01.组会材料': 'meet',
  '02.学习笔记': 'study',
  '011.工具与资源': 'tools',
}


/**
 * 各分区侧边栏的范围策略：
 *   shared —— 整区共用一套侧边栏树，磁盘子目录作为分组标题。三个分区统一用它：
 *            组会材料三类内容互为入口；学习笔记的 02.Python / 03.深度学习 /
 *            04.agent 等分区之间也常互相跳转，收窄到当前子类反而找不到别处；
 *            工具与资源同理。用整区树后，进入任何一篇都能看到同级目录。
 *   scoped —— 按 URL 二级段细分，进入 /study/agent/ 只显示该子类自己的目录。
 *            保留该策略，便于将来某个分区条目过多时单独收紧。
 */
const SECTION_SCOPE: Record<string, 'shared' | 'scoped'> = {
  materials: 'shared',
  study: 'shared',
  tools: 'shared',
}

/**
 * 磁盘二级目录 → URL 二级段。
 *
 * 顶层映射只能定位到 /study/ 这一层，但该分区的 URL 实为 /study/<二级段>/<slug>。
 * 缺 permalink 的页面若只落到 /study/<slug>，就会与 /study/python 这类分区并列，
 * 侧边栏也会被拆散（实测 04.agent 的 11 篇一度散到 5 个前缀下）。
 * 这份表把每个子目录的既有约定固定下来，未写 permalink 的页面据此派生。
 */
const SUBSECTION: Record<string, string> = {
  '02.学习笔记/02.Python': 'study/python',
  '02.学习笔记/03.深度学习': 'study/dl',
  '02.学习笔记/04.agent': 'study/agent',
  '02.学习笔记/04.LLM': 'study/LLM',
  '02.学习笔记/06.强化学习': 'study/rl',
  '02.学习笔记/09.具身智能': 'study/embody',
  '02.学习笔记/10.开发工具': 'study/tools',
  '02.学习笔记/12.ROS': 'study/ros',
  '011.工具与资源/01.Linux相关教程': 'tools/linux',
  '011.工具与资源/02.面试相关': 'tools/interview',
  '011.工具与资源/03.其他资源': 'tools/resources',
  '01.组会材料/01.组会内容': 'materials/meet',
  '01.组会材料/02.论文笔记': 'materials/paper',
  '01.组会材料/03.论文复现': 'materials/reproduction',
}

/** 与 teekConfig.sidebarOption.ignoreList 保持一致：非 md 资源目录不进侧边栏 */
const IGNORED_DIRS = new Set(['03.pdfs', '04.pdfs', '05. 组会pptx', '04. 组会pptx', '03. 组会pptx'])

export interface PageInfo {
  /** 相对 srcDir 的 posix 路径，作为 rewrites 的键 */
  rel: string
  /** 最终 URL，无前后斜杠，形如 meet/20260929 */
  url: string
  /** 侧边栏 / 页面显示用标题 */
  title: string
  /** 磁盘上的目录 posix 路径（不含文件名），用于生成侧边栏树 */
  dir: string
}

/** 标题 → URL slug：保留 Unicode 字母数字，其余转连字符 */
function slugify(title: string) {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function sectionOf(rel: string) {
  return SECTION_PREFIX[rel.split('/')[0]] ?? ''
}

/** rel 落在哪个 URL 前缀下：优先匹配最长的子目录映射。 */
function prefixOf(rel: string): string {
  let best = ''
  for (const [disk, url] of Object.entries(SUBSECTION)) {
    if ((rel === disk || rel.startsWith(`${disk}/`)) && disk.length > best.length) best = url
  }
  return best
}

/**
 * 扫描全部 md，解析出每页的最终 URL。
 * 冲突处理：同 URL 被多文件声明时保留先出现的，另一个退回磁盘原路径（不丢内容）。
 */
export function collectPages(srcDir: string): PageInfo[] {
  const found: PageInfo[] = []

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.vitepress' || entry.name === 'node_modules') continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'superpowers' || IGNORED_DIRS.has(entry.name)) continue
        walk(abs)
        continue
      }
      if (!entry.name.endsWith('.md')) continue

      const rel = path.relative(srcDir, abs).split(path.sep).join('/')
      if (rel.startsWith('superpowers/')) continue
      // 朋友圈碎片（02.moments/ 是纯数据目录，页面本体在 @pages/momentsPage.md）由
      // MomentsTimeline.vue 在构建时聚合成时间线，不生成独立页面：
      // 不进 rewrites / 侧边栏 / RSS / sitemap。
      // 与 config.ts 的 srcExclude、teekConfig.ts 的 fileContentLoaderIgnore 三处口径一致
      if (rel.startsWith('04.随笔/02.moments/')) continue

      let data: Record<string, unknown> = {}
      let content = ''
      try {
        const parsed = matter(fs.readFileSync(abs, 'utf8'), {})
        data = parsed.data as Record<string, unknown>
        content = parsed.content
      } catch {
        // 畸形 frontmatter 不应让整次构建失败，退回用文件名当标题
      }

      const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ''
      const title = String(data.title ?? h1 ?? path.basename(rel, '.md')).trim()

      const permalink = typeof data.permalink === 'string' ? data.permalink.trim() : ''
      const explicit = permalink.startsWith('/') && !permalink.startsWith('//')
      // 顶层 index.md 就是站点首页，URL 必须是 /，不能被标题派生成 /index
      const isHome = rel === 'index.md'

      let url: string
      if (isHome) {
        url = 'index'
      } else if (explicit) {
        url = permalink.replace(/^\/+/, '').replace(/\/+$/, '')
      } else {
        const slug = slugify(title) || slugify(path.basename(rel, '.md'))
        // 落到所属子目录对应的 URL 前缀下（/study/agent/…），而不只是顶层段；
        // 否则同一目录的页面会被拆散到 /study/<slug> 与 /study/agent/… 两处
        const prefix = prefixOf(rel) || sectionOf(rel)
        url = prefix ? `${prefix}/${slug}` : slug
      }

      found.push({ rel, url, title, dir: path.dirname(rel).split(path.sep).join('/') })
    }
  }

  walk(srcDir)
  found.sort((a, b) => a.rel.localeCompare(b.rel))

  // 去重：URL 撞车时后者退回磁盘原路径
  const taken = new Map<string, string>()
  return found.map((p) => {
    const prev = taken.get(p.url)
    if (!prev) {
      taken.set(p.url, p.rel)
      return p
    }
    console.warn(
      `[permalinks] URL "${p.url}" 被 ${prev} 与 ${p.rel} 同时占用；` +
        `${p.rel} 不改写，继续使用磁盘源路径 ${p.rel.replace(/\.md$/, '')}`,
    )
    const fallback = p.rel.replace(/\/index\.md$/, '').replace(/\.md$/, '')
    taken.set(fallback, p.rel)
    return { ...p, url: fallback }
  })
}

/**
 * 生成 VitePress rewrites 映射。
 *
 * 若某 URL 是其它 URL 的父目录（/meet 与 /meet/20260929 并存），必须落成
 * <url>/index.md：落成 <url>.md 会与同名目录冲突，VitePress 会静默丢掉那个
 * .html，目录内又无 index.html，该路由最终 404。
 */
export function buildRewrites(pages: PageInfo[]) {
  const urls = new Set(pages.map((p) => p.url))
  const map = new Map<string, string>()

  for (const p of pages) {
    // 首页必须停在 index.md：改写成 /index.md 会被算成「与 index/ 目录冲突」而被跳过
    if (p.rel === 'index.md') {
      map.set(p.rel, 'index.md')
      continue
    }
    const prefix = `${p.url}/`
    const isSection = [...urls].some((u) => u !== p.url && u.startsWith(prefix))
    const explicit = p.rel.split('/').pop() === 'index.md'
    map.set(p.rel, isSection || explicit ? `${p.url}/index.md` : `${p.url}.md`)
  }

  // 用函数形式而非对象形式：对象形式的键会走 path-to-regexp 编译，
  // 遇到标题派生的特殊字符（如 ManiGaussian++ 的 `++`）会直接抛错。
  return (rel: string) => map.get(rel)
}

interface SidebarItem {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

/**
 * 把一组页面按磁盘目录聚成侧边栏树。
 *
 * 直接在 p.dir 的每一段上递归，而不是先收集全部子目录再逐个处理 —— 后者会把
 * 同一祖先下的兄弟目录反复输出（表现为多个同名分组，如四个「01.组会材料」）。
 *
 * `dir` 是当前递归到的磁盘目录（不含文件名）。侧边栏不从顶层目录起头 ——
 * 该层与 URL 前缀 /meet 指向同一范围，显示出来纯属冗余（用户明确要求去掉），
 * 调用方用 commonDir 把起点定在顶层目录的下一层。
 * `dir` 为 undefined 时从磁盘顶层目录起头。
 */
function buildGroups(pages: PageInfo[], dir?: string): SidebarItem[] {
  const items: SidebarItem[] = []

  if (dir !== undefined) {
    const here = pages.filter((x) => x.dir === dir).sort((a, b) => a.rel.localeCompare(b.rel))
    for (const p of here) items.push({ text: p.title, link: '/' + p.url })
  }

  // 只取 dir 的直接下一层：孙目录若也进候选，递归时会多包一层同名壳。
  const childDepth = dir === undefined ? 1 : dir.split('/').length + 1

  const childDirs = new Set<string>()
  for (const p of pages) {
    // 必须先判定 p 在 dir 之下。少了这一句，递归到某个子目录时会把**兄弟目录**
    // 也当成子目录收进来：/study/ 的树曾把 03.深度学习 嵌进 02.Python，
    // 45 篇文章被算成 254 项，tools/ 下同一份 001.必备工具 还出现两次。
    if (dir !== undefined && p.dir !== dir && !p.dir.startsWith(dir + '/')) continue
    if (p.dir === '.') continue
    const segs = p.dir.split('/')
    if (segs.length < childDepth) continue
    childDirs.add(segs.slice(0, childDepth).join('/'))
  }

  const children = [...childDirs]
    .map((d) => ({ dir: d, name: d.split('/').pop() as string }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  for (const c of children) {
    const nested = buildGroups(pages, c.dir)
    if (nested.length) items.push({ text: c.name, collapsed: true, items: nested })
  }

  return items
}
/** 求一组目录路径的最长公共前缀（分段比较）。没有公共段时返回 ''。 */
function commonDir(dirs: string[][]): string {
  if (!dirs.length) return ''
  const first = dirs[0]
  let n = 0
  for (let i = 0; i < first.length; i++) {
    const seg = first[i]
    if (dirs.every((d) => d[i] === seg)) n = i + 1
    else break
  }
  return n === 0 ? '' : first.slice(0, n).join('/')
}

/**
 * 生成 themeConfig.sidebar。
 *
 * 键必须是页面**实际 URL** 的前缀，而不能是磁盘目录名：getSidebar 只做
 * `path.startsWith(dir)` 匹配，论文笔记的 URL 是 /papers/* 而磁盘上仍在
 * 01.组会材料/02.论文笔记/ 下，按磁盘分组会漏掉 /papers/ 这个键，
 * 结果该区所有页面侧边栏为空。
 *
 * 做法是从每页的最终 URL 反推分区段（URL 第一段），据此聚合。
 */
export function buildSidebar(pages: PageInfo[]) {
  const sidebar: Record<string, SidebarItem[]> = {}

  const isIndexLike = (rel: string) => {
    const base = rel.split('/').pop() as string
    return base === 'index.md' || /^0*\.?目录\.md$/.test(base)
  }
  const usable = pages.filter((p) => p.rel.endsWith('.md') && !isIndexLike(p.rel))

  for (const [seg, scope] of Object.entries(SECTION_SCOPE)) {
    const all = usable.filter((p) => p.url === seg || p.url.startsWith(`${seg}/`))
    if (!all.length) continue

    if (scope === 'shared') {
      // 整区共用一套侧边栏：组会材料的三类内容（组会记录 / 论文笔记 / 论文复现）
      // 互相之间跳转会频繁，收窄到当前子类反而找不到另一类内容。
      const start = commonDir(all.map((p) => p.rel.split('/').slice(0, -1)))
      const items = buildGroups(all, start || undefined)
      if (items.length) sidebar[`${seg}/`] = items
      continue
    }

    // scoped：按 URL 二级段各建一个键。getSidebar 取**最长匹配前缀**，所以
    // /study/agent/ 比 /study/ 更具体 —— 进入 agent 的文章时用它，侧边栏
    // 只显示 04.agent 自己的子目录，而不是整个学习笔记的 8 个分区。
    const subs = new Set(
      all.filter((p) => p.url.split('/').length > 2).map((p) => p.url.split('/')[1]),
    )
    for (const s of subs) {
      const content = all.filter((p) => p.url.startsWith(`${seg}/${s}/`))
      if (!content.length) continue
      // 同样按磁盘目录分组，让分组名保持为 001.Agent核心概念 这类可读名称
      const start = commonDir(content.map((p) => p.rel.split('/').slice(0, -1)))
      const items = buildGroups(content, start || undefined)
      if (items.length) sidebar[`${seg}/${s}/`] = items
    }

    // 分区自身也留一份，供 /study 这类聚合页显示全部子类
    const start = commonDir(all.map((p) => p.rel.split('/').slice(0, -1)))
    const items = buildGroups(all, start || undefined)
    if (items.length) sidebar[`${seg}/`] = items
  }

  return sidebar
}
