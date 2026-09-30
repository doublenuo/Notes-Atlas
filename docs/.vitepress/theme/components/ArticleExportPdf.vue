<script setup lang="ts" name="ArticleExportPdf">
/** 正文容器：导出内容以 .vp-doc 为准（含文章 H1 标题） */
const getDoc = () => document.querySelector<HTMLElement>(".vp-doc");

/** 等字体就绪：字体未就绪时中文与公式可能掉字 */
const waitForFonts = async () => {
  if (document.fonts?.ready) await document.fonts.ready;
};

/** 等图片就绪：未加载完的图片在 PDF 里是空白块（懒加载图改 eager 后等 decode） */
const waitForImages = async () => {
  const doc = getDoc();
  if (!doc) return;

  const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map(async img => {
      if (img.complete) return;
      img.loading = "eager";
      try {
        await img.decode();
      } catch {
        /* 未完成或跨域图片 decode 会失败，不阻断打印 */
      }
    })
  );
};

/** 等 mermaid 画完：mermaid 为客户端渲染，未完成时导出缺图；上限 1.5s 后放弃 */
const waitForMermaid = async (timeout = 1500) => {
  const doc = getDoc();
  if (!doc) return;

  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (!doc.querySelector(".mermaid:not([data-processed='true'])")) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

/** 折叠的 details 打印时仍是收起状态，导出前展开 */
const expandDetails = () => {
  getDoc()?.querySelectorAll<HTMLDetailsElement>("details").forEach(item => (item.open = true));
};

const handleClick = async () => {
  try {
    await waitForFonts();
    await waitForImages();
    await waitForMermaid();
    expandDetails();
  } catch (error) {
    // 预处理异常不得阻断打印
    console.warn("[导出 PDF] 打印前预处理异常：", error);
  } finally {
    window.print();
  }
};
</script>

<template>
  <div class="tk-pdf-export">
    <button class="tk-pdf-export__button" type="button" title="导出 PDF" aria-label="导出 PDF" @click="handleClick">
      <!-- 内联 SVG（文件 + 下箭头） -->
      <svg
        class="tk-pdf-export__icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M12 11v5" />
        <path d="m9.5 13.5 2.5 2.5 2.5-2.5" />
      </svg>
      <span class="tk-pdf-export__text">导出 PDF</span>
    </button>
  </div>
</template>

<style>
/* 并排布局：.VPDocAside 改为横向 flex，分享按钮 flex:1 收缩、导出按钮固定宽。
   关键：设 flex-grow:0 + height:auto，防止 .VPDocAside 撑满整屏导致元素分散。
   不支持 :has() 的浏览器退化为上下排列，不破版。 */
.VPDocAside:has(> .tk-pdf-export) {
  flex-direction: row;
  flex-wrap: wrap;
  flex-grow: 0;
  height: auto;
  column-gap: 8px;
}

.VPDocAside:has(> .tk-pdf-export) > .tk-article-share {
  flex: 1 1 auto;
  min-width: 0;
}

.VPDocAside:has(> .tk-pdf-export) > .tk-pdf-export {
  flex: 0 0 auto;
  padding: 14px 0;
}

/* 目录（content）、spacer 等其余块回到整行 */
.VPDocAside:has(> .tk-pdf-export) > :not(.tk-article-share):not(.tk-pdf-export) {
  flex: 1 1 100%;
}

/* 目录长文本自动换行 */
.VPDocAside:has(> .tk-pdf-export) .outline-link,
.VPDocAside:has(> .tk-pdf-export) .VPDocAsideOutline a {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.tk-pdf-export__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background-color: var(--vp-c-bg-alt);
  color: var(--tk-theme-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--tk-transition-duration-slow) cubic-bezier(0.25, 0.8, 0.25, 1);
}

.tk-pdf-export__icon {
  flex-shrink: 0;
  font-size: 16px;
}

.tk-pdf-export__text {
  display: inline-block;
}

.tk-pdf-export__button:hover {
  background-color: var(--vp-c-brand-soft);
  transform: translateY(-1px);
}

.tk-pdf-export__button:active {
  transform: scale(0.9);
}
</style>