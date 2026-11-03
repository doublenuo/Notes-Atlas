/**
 * 中文 permalink → 英文 slug 批量重命名。
 *
 * 背景：126 个页面的 permalink 含中文（如 /study/常用命令）。中文 URL 在分享、
 * 复制粘贴、部分工具链里会被百分号转义，观感与可用性差。本脚本按标题把 slug
 * 翻译为英文，命名空间沿用各目录既有的约定（详见 scripts/audit-permalinks.mjs
 * 与 permalinks.ts 的 SUBSECTION 表）：
 *   - 已有命名空间的目录 → /study/dl|agent|rl|ros|embody|math|tools/<slug>
 *   - 从未有过命名空间的目录（Linux基础/机器人学/运动控制进阶/C++/仿真与工具）
 *     → 保持顶层 /study/<slug>，不擅自发明新命名空间
 *
 * 做法：对全仓源码做「旧 URL 字符串 → 新 URL 字符串」替换（frontmatter 与
 * 交叉引用一次搞定），替换带边界检查，不会误伤更长 URL 的前缀。
 *
 * 注意：URL 会变，已发布的外链/RSS/搜索引擎收录会 404（站点自定义 404 页
 * 可后续加旧→新跳转映射缓解）。
 *
 * 用法：node scripts/rename-permalinks-en.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { fileURLToPath } from 'node:url'
import { collectPages } from '../docs/.vitepress/permalinks.ts'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS_ROOT = path.join(REPO_ROOT, 'docs')
const DRY_RUN = process.argv.includes('--dry-run')

/** 旧 URL（不含首斜杠）→ 新 URL（不含首斜杠）。键必须与现存 permalink 完全一致 */
const MAP = {
  // 00.数学基础 → /study/math/
  'study/最优化基础': 'study/math/optimization-basics',
  // 01.Linux基础 → /study/（该目录无命名空间约定，保持顶层）
  'study/linux入门与文件系统': 'study/linux-intro-filesystem',
  'study/常用命令': 'study/common-commands',
  'study/文本处理与查找': 'study/text-processing-search',
  'study/用户-权限与sudo': 'study/users-permissions-sudo',
  'study/软件包管理': 'study/package-management',
  'study/进程与系统资源管理': 'study/process-resource-management',
  'study/shell与环境变量': 'study/shell-env-variables',
  'study/vim与tmux': 'study/vim-tmux',
  'study/网络与远程连接': 'study/network-remote-access',
  'study/磁盘-挂载与存储管理': 'study/disk-mount-storage',
  'study/gpu与驱动相关命令': 'study/gpu-driver-commands',
  'study/日志与故障排查': 'study/logs-troubleshooting',
  'study/构建工具': 'study/build-tools',
  // 03.深度学习 → /study/dl/
  'study/dl/现代-cnn-架构': 'study/dl/modern-cnn-architectures',
  'study/dl/视觉任务拓展': 'study/dl/vision-tasks',
  'study/dl/循环神经网络': 'study/dl/recurrent-neural-networks',
  'study/dl/注意力机制与-transformer': 'study/dl/attention-and-transformer',
  'study/dl/预训练语言模型': 'study/dl/pretrained-language-models',
  'study/dl/经典生成模型': 'study/dl/classic-generative-models',
  'study/dl/扩散模型与大模型': 'study/dl/diffusion-and-llms',
  'study/dl/图神经网络与自监督学习': 'study/dl/gnns-and-self-supervised',
  'study/dl/工程实践与前沿议题': 'study/dl/engineering-and-frontiers',
  // 04.Agent基础 → /study/agent/
  'study/agent通信协议': 'study/agent/agent-communication-protocols',
  'study/moe架构': 'study/agent/moe-architecture',
  'study/绪论与-agent-概念': 'study/agent/intro-and-concepts',
  'study/llm-基础与提示工程': 'study/agent/llm-basics-and-prompting',
  'study/工具调用与函数调用': 'study/agent/tool-and-function-calling',
  'study/推理与规划': 'study/agent/reasoning-and-planning',
  'study/记忆系统与-rag': 'study/agent/memory-and-rag',
  'study/反思与自我改进': 'study/agent/reflection-and-self-improvement',
  'study/agent-框架与协议': 'study/agent/frameworks-and-protocols',
  'study/多智能体系统': 'study/agent/multi-agent-systems',
  'study/代码-agent-与计算机操作-agent': 'study/agent/code-and-computer-agents',
  'study/多模态与具身-agent': 'study/agent/multimodal-and-embodied-agents',
  'study/agent-的强化学习训练': 'study/agent/rl-training',
  'study/评测与可观测性': 'study/agent/evaluation-and-observability',
  'study/安全-对齐与可靠性': 'study/agent/safety-alignment-reliability',
  'study/工程落地与产品化': 'study/agent/engineering-and-productization',
  'study/前沿专题与开放问题': 'study/agent/frontiers-and-open-problems',
  // 05.机器人学与经典控制 → /study/（顶层）
  'study/绪论与数学基础': 'study/robotics-intro-and-math',
  'study/刚体运动与旋转表示': 'study/rigid-body-and-rotation',
  'study/正运动学与微分运动学': 'study/forward-and-differential-kinematics',
  'study/逆运动学': 'study/inverse-kinematics',
  'study/动力学建模': 'study/dynamics-modeling',
  'study/高效动力学算法': 'study/efficient-dynamics-algorithms',
  'study/浮动基动力学与接触': 'study/floating-base-and-contact',
  'study/经典控制与关节控制': 'study/classic-and-joint-control',
  'study/状态空间与稳定性': 'study/state-space-and-stability',
  'study/最优控制与-lqr': 'study/optimal-control-and-lqr',
  'study/轨迹优化与模型预测控制': 'study/trajectory-optimization-and-mpc',
  'study/足式运动基础与简化模型': 'study/legged-locomotion-basics',
  'study/步态规划与预览控制': 'study/gait-planning-and-preview-control',
  'study/足式机器人-mpc': 'study/legged-robot-mpc',
  'study/全身控制与力控': 'study/whole-body-and-force-control',
  // 06.强化学习基础 + 07.RL运动控制核心 → /study/rl/
  'study/世界模型与规划': 'study/rl/world-models-and-planning',
  'study/大规模并行与实验规范': 'study/rl/large-scale-parallel-and-experiments',
  'study/特权信息学习与自适应': 'study/rl/privileged-info-and-adaptation',
  'study/人形机器人行走与稳定': 'study/rl/humanoid-walking-and-stability',
  'study/sim-to-real-部署与工程实践': 'study/rl/perceptive-locomotion',
  'study/动作模仿与拟人步态': 'study/rl/motion-imitation-and-gait',
  'study/全身运动跟踪与高动态技能': 'study/rl/whole-body-tracking-and-skills',
  'study/sim-to-sim-验证与部署管线': 'study/rl/sim-to-sim-and-deployment',
  // 08.运动控制进阶 → /study/（顶层）
  'study/传感器与姿态估计': 'study/sensors-and-attitude-estimation',
  'study/卡尔曼滤波与-ekf': 'study/kalman-filter-and-ekf',
  'study/腿式机器人状态估计': 'study/legged-state-estimation',
  'study/策略导出与推理运行时': 'study/policy-export-and-inference',
  'study/sim-to-sim-验证': 'study/sim-to-sim-validation',
  'study/c-实时控制回路': 'study/cpp-realtime-control-loop',
  'study/ros-2-与-ros2-control-集成': 'study/ros2-and-ros2-control',
  'study/动作模仿与全身运动跟踪': 'study/imitation-and-whole-body-tracking',
  'study/混合控制与鲁棒性': 'study/hybrid-control-and-robustness',
  // 09.具身智能 → /study/embody/
  'study/embody/具身智能概览与技术路线': 'study/embody/overview-and-roadmap',
  'study/embody/人形机器人硬件与平台对比': 'study/embody/humanoid-hardware-platforms',
  'study/embody/模仿学习与遥操作数据采集': 'study/embody/imitation-and-teleoperation',
  'study/embody/扩散策略与动作生成': 'study/embody/diffusion-policy',
  'study/embody/flow-matching策略': 'study/embody/flow-matching',
  'study/embody/vla模型': 'study/embody/vla-models',
  'study/embody/高层规划与低层技能结合': 'study/embody/planning-and-skills',
  // 10.开发工具/001.Docker → /study/tools/
  'study/tools/第一章-docker快速入门': 'study/tools/docker-ch1-quickstart',
  'study/tools/第二章-docker底层实现原理': 'study/tools/docker-ch2-internals',
  'study/tools/第三章-docker安装与基础配置': 'study/tools/docker-ch3-install-config',
  'study/tools/第四章-docker核心概念': 'study/tools/docker-ch4-core-concepts',
  'study/tools/第五章-dockerfile详解': 'study/tools/docker-ch5-dockerfile',
  'study/tools/第六章-docker数据卷管理': 'study/tools/docker-ch6-volumes',
  'study/tools/第七章-docker网络管理': 'study/tools/docker-ch7-networking',
  'study/tools/第八章-docker-compose': 'study/tools/docker-ch8-compose',
  'study/tools/容器编排基础': 'study/tools/orchestration-basics',
  // 10.开发工具/002.Git → /study/tools/
  'study/tools/版本控制与git入门': 'study/tools/git-ch1-vcs-intro',
  'study/tools/安装与基础配置': 'study/tools/git-ch2-install-config',
  'study/tools/本地仓库基础操作': 'study/tools/git-ch3-local-basics',
  'study/tools/查看历史与对比差异': 'study/tools/git-ch4-history-diff',
  'study/tools/撤销与回退': 'study/tools/git-ch5-undo',
  'study/tools/分支管理': 'study/tools/git-ch6-branching',
  'study/tools/合并-变基与冲突解决': 'study/tools/git-ch7-merge-rebase',
  'study/tools/远程仓库与github': 'study/tools/git-ch8-remote-github',
  'study/tools/协作工作流': 'study/tools/git-ch9-workflows',
  'study/tools/标签与版本发布': 'study/tools/git-ch10-tags-releases',
  'study/tools/子模块与大文件管理': 'study/tools/git-ch11-submodules-lfs',
  'study/tools/git进阶技巧': 'study/tools/git-ch12-advanced',
  'study/tools/规范与最佳实践': 'study/tools/git-ch13-best-practices',
  // 11.C++基础与工程 → /study/（顶层）
  'study/c-基础与内存管理': 'study/cpp-basics-and-memory',
  'study/stl与模板': 'study/stl-and-templates',
  'study/多线程与并发': 'study/multithreading-and-concurrency',
  'study/cmake与构建系统': 'study/cmake-and-build-systems',
  'study/eigen线性代数库': 'study/eigen-linear-algebra',
  // 12.ROS → /study/ros/
  'study/ros/绪论与环境搭建': 'study/ros/intro-and-setup',
  'study/ros/节点与话题通信': 'study/ros/nodes-and-topics',
  'study/ros/服务-动作与参数': 'study/ros/services-actions-params',
  'study/ros/launch-功能包与工程规范': 'study/ros/launch-and-packages',
  'study/ros/dds-与-qos': 'study/ros/dds-and-qos',
  'study/ros/坐标变换-tf2-与机器人描述': 'study/ros/tf2-and-urdf',
  'study/ros/时间-实时性与多线程': 'study/ros/time-realtime-threading',
  'study/ros/机器人仿真': 'study/ros/simulation',
  'study/ros/传感器与感知': 'study/ros/sensors-and-perception',
  'study/ros/定位与建图': 'study/ros/localization-and-mapping',
  'study/ros/自主导航-nav2': 'study/ros/navigation-nav2',
  'study/ros/机械臂操作-moveit-2': 'study/ros/manipulation-moveit2',
  'study/ros/ros2-control-与硬件接口': 'study/ros/ros2-control-interfaces',
  'study/ros/调试-测试与部署': 'study/ros/debugging-and-deployment',
  'study/ros/前沿专题与智能体集成': 'study/ros/frontiers-and-agents',
  // 13.仿真与工具 → /study/（顶层）
  'study/mujoco入门': 'study/mujoco-intro',
  'study/isaacgym基础': 'study/isaacgym-basics',
  'study/isaaclab教程': 'study/isaaclab-tutorial',
  'study/pinocchio与drake使用': 'study/pinocchio-and-drake',
  'study/casadi与osqp求解器': 'study/casadi-and-osqp',
}

const SOURCE_EXTS = new Set(['.md', '.ts', '.vue', '.js', '.mjs', '.scss', '.css', '.json', '.yml', '.yaml'])
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'cache'])
/** 本脚本自身：MAP 里内嵌全部旧 URL，参与替换会把映射表改坏 */
const SKIP_FILES = new Set([path.basename(import.meta.url)])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (SOURCE_EXTS.has(path.extname(f)) && !SKIP_FILES.has(e.name)) out.push(f)
  }
  return out
}

// ---- 前置校验 ----
// 1. 映射的旧 URL 必须与现存 permalink 完全对应（一个不多一个不少）
const pages = collectPages(DOCS_ROOT)
const current = new Set()
for (const p of pages) {
  const data = matter(fs.readFileSync(path.join(DOCS_ROOT, p.rel), 'utf8')).data
  const pl = typeof data.permalink === 'string' ? data.permalink.trim().replace(/^\/+|\/+$/g, '') : ''
  if (pl) current.add(pl)
}
const mapKeys = new Set(Object.keys(MAP))
const notInSite = [...mapKeys].filter((k) => !current.has(k))
if (notInSite.length) {
  console.error(`[rename] 终止：${notInSite.length} 个映射键不是现存 permalink：\n  ${notInSite.join('\n  ')}`)
  process.exit(1)
}
const cnLeft = [...current].filter((u) => /[^\x00-\x7F]/.test(u) && !mapKeys.has(u))
if (cnLeft.length) {
  console.error(`[rename] 终止：${cnLeft.length} 个中文 permalink 未在映射中：\n  ${cnLeft.join('\n  ')}`)
  process.exit(1)
}
// 2. 新 URL 必须全 ASCII、互不重复、且不与现存 ASCII URL 撞车
const newUrls = Object.values(MAP)
const asciiBad = newUrls.filter((u) => /[^\x00-\x7F]/.test(u))
if (asciiBad.length) {
  console.error(`[rename] 终止：新 URL 含非 ASCII：${asciiBad.join(', ')}`)
  process.exit(1)
}
const newDupes = newUrls.filter((u, i) => newUrls.indexOf(u) !== i)
if (newDupes.length) {
  console.error(`[rename] 终止：新 URL 内部重复：${newDupes.join(', ')}`)
  process.exit(1)
}
const asciiExisting = [...current].filter((u) => !mapKeys.has(u))
const clash = newUrls.filter((u) => asciiExisting.includes(u))
if (clash.length) {
  console.error(`[rename] 终止：新 URL 与现存 URL 撞车：${clash.join(', ')}`)
  process.exit(1)
}
console.log(`[rename]${DRY_RUN ? '（dry-run）' : ''} 映射 ${mapKeys.size} 个 URL，前置校验通过`)

// ---- 执行替换 ----
// 边界：旧 URL 前后不能再跟 URL 路径字符（字母/数字/连字符/斜杠），
// 避免 /study/常用命令 误伤 /study/常用命令-进阶 这类更长 URL。
// 注意：匹配与替换都不带首斜杠 —— 文本里的首斜杠是上下文，替换时若带上会多出一个
// （/study/x → //study/new），且 // 开头的 permalink 不被 collectPages 认作显式声明。
const entries = Object.entries(MAP).map(([oldUrl, newUrl]) => ({
  re: new RegExp(`(?<![\\w-])${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w/-])`, 'g'),
  newUrl,
  oldUrl,
}))

const files = walk(REPO_ROOT)
let changedFiles = 0
let totalHits = 0
const perFile = []
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  let next = text
  let hits = 0
  for (const e of entries) {
    next = next.replace(e.re, () => {
      hits++
      return e.newUrl
    })
  }
  if (hits) {
    changedFiles++
    totalHits += hits
    perFile.push({ file: path.relative(REPO_ROOT, f), hits })
    if (!DRY_RUN) fs.writeFileSync(f, next)
  }
}
console.log(`[rename] ${DRY_RUN ? '将修改' : '已修改'} ${changedFiles} 个文件、${totalHits} 处引用`)
for (const p of perFile.sort((a, b) => b.hits - a.hits).slice(0, 8)) {
  console.log(`  ${p.hits.toString().padStart(3)} 处  ${p.file}`)
}

// ---- 后置校验：源码里不应再有旧 URL 残留 ----
if (!DRY_RUN) {
  let leftover = 0
  for (const f of walk(REPO_ROOT)) {
    const text = fs.readFileSync(f, 'utf8')
    for (const e of entries) {
      if (text.includes(e.oldUrl)) {
        console.error(`[rename] 残留旧 URL：${path.relative(REPO_ROOT, f)} 仍含 ${e.oldUrl}`)
        leftover++
      }
    }
  }
  // 双斜杠防护：替换不带首斜杠，文本里不应出现 //<映射值> 形态
  for (const f of walk(REPO_ROOT)) {
    const text = fs.readFileSync(f, 'utf8')
    for (const e of entries) {
      if (text.includes(`//${e.newUrl}`)) {
        console.error(`[rename] 双斜杠残留：${path.relative(REPO_ROOT, f)} 含 //${e.newUrl}`)
        leftover++
      }
    }
  }
  if (leftover) process.exit(1)
  console.log('[rename] 后置校验通过：源码中无旧 URL 残留、无双斜杠')
}
