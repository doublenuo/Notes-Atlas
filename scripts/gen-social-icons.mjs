/**
 * 导航栏社交图标的内联 SVG 数据。
 *
 * 背景：VitePress 的 themeConfig.socialLinks 只内置了 github 等少量图标
 * （vpi-social-* CSS mask 类），未知字符串名虽会在运行时回退到
 * api.iconify.design/simple-icons/{name}.svg 拉取，但仅限 simple-icons 库、
 * 且依赖运行时网络。这里改为内联 SVG 对象（VPSocialLink 的 { svg } 形态），
 * 构建期固化、零运行时依赖。
 *
 * 数据来源（均为 24x24、fill=currentColor，继承导航图标颜色与 hover 过渡）：
 *   - zhihu：@iconify-json/simple-icons（本地 node_modules 提取）
 *   - cnb：tdesign/logo-cnb（Iconify API 一次性拉取后固化）
 *   - email：@iconify-json/simple-icons 的 minutemailer（填充式信封）
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const HERE = path.dirname(fileURLToPath(import.meta.url))

/** 从本地 @iconify-json/simple-icons 取图标 body，包成完整 SVG */
function fromSimpleIcons(name) {
  const p = require.resolve('@iconify-json/simple-icons/icons.json')
  const si = JSON.parse(fs.readFileSync(p, 'utf8'))
  const body = si.icons[name]?.body
  if (!body) throw new Error(`simple-icons 中不存在 ${name}`)
  return wrap(body)
}

/** 从 Iconify API 取图标 body（仅生成期执行一次，结果固化进本文件） */
async function fromIconifyApi(prefix, name) {
  const res = await fetch(`https://api.iconify.design/${prefix}.json?icons=${name}`)
  const json = await res.json()
  const body = json.icons?.[name]?.body
  if (!body) throw new Error(`Iconify API 中不存在 ${prefix}:${name}`)
  return wrap(body)
}

/** body 已是 <path fill="currentColor" .../> 形态，外包 svg 壳并压成单行 */
function wrap(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${body.replace(/\s+/g, ' ').trim()}</svg>`
}

// ---- 生成 socialIcons.ts ----
const zhihu = fromSimpleIcons('zhihu')
const email = fromSimpleIcons('minutemailer')
const cnb = await fromIconifyApi('tdesign', 'logo-cnb')

const out = `/**
 * 导航栏社交图标的内联 SVG 数据（由 scripts/gen-social-icons.mjs 生成，请勿手改）。
 *
 * VitePress 内置 socialLinks 图标有限（vpi-social-* mask 类），知乎 / CNB / 邮箱
 * 需自定义 SVG。均为 24x24、fill=currentColor，随导航图标颜色与 hover 过渡变化。
 * 数据来源：simple-icons（本地）、tdesign（Iconify API 一次性拉取）。
 */

/** 知乎 */
export const zhihuIcon = ${JSON.stringify(zhihu)}

/** CNB.cool */
export const cnbIcon = ${JSON.stringify(cnb)}

/** 邮箱（minutemailer 信封图标） */
export const emailIcon = ${JSON.stringify(email)}
`

const target = path.join(HERE, '..', 'docs', '.vitepress', 'socialIcons.ts')
fs.writeFileSync(target, out)
console.log(`[gen-social-icons] 已生成 ${path.relative(process.cwd(), target)}`)
console.log(`  zhihu: ${zhihu.length} 字符`)
console.log(`  cnb:   ${cnb.length} 字符`)
console.log(`  email: ${email.length} 字符`)
