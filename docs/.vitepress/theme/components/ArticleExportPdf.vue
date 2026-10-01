<script setup lang="ts" name="ArticleExportPdf">
import { onMounted, ref, shallowRef } from "vue";

/**
 * 把按钮搬进 teek 的分享块内部，与「分享此页面」并排。
 * 不能改 .VPDocAside 的 flex 方向：它是 height:100vh 容器里的 column flex，
 * 一旦改成 row，其子元素（含 flex-grow:1 的 .spacer 与目录）会被重新分配，
 * 导致右栏被撑满、元素纵向散开。搬进分享块则完全不触碰右栏垂直布局。
 */
const shareHost = shallowRef<HTMLElement | null>(null);
const teleported = ref(false);

onMounted(() => {
  shareHost.value = document.querySelector<HTMLElement>(".tk-article-share");
  teleported.value = Boolean(shareHost.value);
});

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
  <Teleport v-if="teleported" :to="shareHost">
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
  </Teleport>
</template>

<style>
/* 只把分享块改成横向 flex —— 不触碰 .VPDocAside 的 flex-grow / flex-direction，
   避免 100vh 高容器里的子元素被重新分配而撑满整屏。
   :has() 不生效时退化为上下堆叠，不会破版。 */
.tk-article-share:has(> .tk-pdf-export) {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

/* 分享按钮吃掉剩余宽度；min-width:0 让长文字可收缩而不撑破容器。
   nowrap 必需：被导出按钮挤窄时 teek 的文字会换行，把按钮撑高到 64px，
   导致两按钮不同高。 */
.tk-article-share:has(> .tk-pdf-export) > .tk-article-share__button {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
}

/* 导出按钮按内容定宽，两按钮合计不超过分享块原宽，右栏 224px 不被撑宽。
   align-items:stretch 下由分享按钮决定行高，两按钮自动等高。 */
.tk-article-share:has(> .tk-pdf-export) > .tk-pdf-export {
  flex: 0 0 auto;
  display: flex;
}

.tk-pdf-export__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  align-self: stretch;
  padding: 0 10px;
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