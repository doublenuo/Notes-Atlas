<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useData } from "vitepress";
import type { MermaidConfig } from "mermaid";

const props = defineProps<{
  graph: string;
  id: string;
  class?: string;
}>();

const { frontmatter } = useData();
const svg = ref("");
const error = ref("");
const processed = ref(false);

let mermaid: typeof import("mermaid").default | null = null;
let observer: MutationObserver | null = null;
let unmounted = false;

async function getMermaid() {
  if (!mermaid) {
    const module = await import("mermaid");
    mermaid = module.default;
  }
  return mermaid;
}

async function renderChart() {
  if (unmounted) return;
  error.value = "";
  try {
    const instance = await getMermaid();
    const configuredTheme = frontmatter.value?.mermaidTheme as MermaidConfig["theme"] | undefined;
    const theme: MermaidConfig["theme"] = document.documentElement.classList.contains("dark")
      ? "dark"
      : configuredTheme ?? "default";

    instance.initialize({ startOnLoad: false, securityLevel: "loose", theme });
    const { svg: rendered } = await instance.render(props.id, decodeURIComponent(props.graph));
    if (unmounted) return;
    // v-html 不会因相同 SVG 字符串而重绘，加一个随机后缀强制更新主题
    svg.value = `${rendered}<span style="display:none">${Math.random().toString(36).slice(2)}</span>`;
    processed.value = true;
  } catch (cause) {
    if (!unmounted) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      processed.value = true;
    }
  }
}

onMounted(async () => {
  await renderChart();
  observer = new MutationObserver(() => void renderChart());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
});

onUnmounted(() => {
  unmounted = true;
  observer?.disconnect();
});
</script>

<template>
  <div
    v-if="error"
    :class="[props.class, 'mermaid-error']"
    :data-processed="processed ? 'true' : undefined"
  >
    {{ error }}
  </div>
  <div
    v-else
    v-html="svg"
    :class="props.class"
    :data-processed="processed ? 'true' : undefined"
  />
</template>
