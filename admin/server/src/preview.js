import MarkdownIt from "markdown-it";
import { obsidianEmbed } from "../shared/obsidianEmbed.js";
import { parseDoc } from "./frontmatter.js";

/**
 * 预览渲染器:markdown-it 单例 + obsidianEmbed(真实展开 ![[嵌入]] 与 [[双链]])。
 *
 * - html:false —— 刻意比站点(VitePress 默认 html:true)更严格:预览产出的 HTML 会被
 *   注入 admin 页面 DOM,不让作者的内联 HTML 在此执行,比像素级对齐更值钱。代价是
 *   笔记里的 <br>/<details>/<u>/<sub> 等内联标签在预览中显示为字面文本。
 *   承重的安全事实:插件对被嵌入正文走同一 markdown-it 实例的二次解析,所以
 *   html:false 与全部 inline 规则对嵌套内容同样生效——不是逐处记得调 escapeHtml。
 * - resolver 跨请求复用:createResolver 的全库 walk() 索引只建一次,之后每次渲染
 *   只 readNote 实际嵌入的目标文件(内容无缓存,改已有笔记实时生效)。
 *   **代价**:索引是进程内永久缓存且惰性建立。论文目录与带 / 的路径目标走
 *   existsSync 始终实时,但在论文目录外新建的笔记需重启容器才能被裸目标名命中;
 *   在线编辑场景下表现为「未找到嵌入笔记」告警块。
 * - relPath 只作日志归因:插件仅用它标注告警来自哪一页,不参与链接解析——
 *   输出 href 是站点根绝对路径(/01.组会材料/02.论文笔记/ADAPT 形式)。
 * - 公式不装服务端插件:markdown-it 原样透传,KaTeX 在浏览器侧扫描排版。
 */
export function createPreviewRenderer({ docsDir }) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
  obsidianEmbed(md, docsDir);

  return {
    render(content, relPath = "") {
      let body = content;
      let title = "";
      try {
        const parsed = parseDoc(content);
        body = parsed.body;
        title = typeof parsed.frontmatter.title === "string" ? parsed.frontmatter.title : "";
      } catch {
        // 畸形 frontmatter:退回渲染全文(可见降级,语义同 obsidianEmbed 的 readNote)
        console.warn(`[preview] frontmatter 解析失败,已退回全文渲染(页面：${relPath || "unknown"})`);
      }
      return { html: md.render(body, { relativePath: relPath }), title };
    },
  };
}
