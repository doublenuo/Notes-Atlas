<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from "vue";

// 真正的 Giscus chunk（~52KB gzip）在 visible 后才开始拉取
const Giscus = defineAsyncComponent(() => import("@giscus/vue"));

const root = ref<HTMLElement>();
const visible = ref(false);
let observer: IntersectionObserver | undefined;

onMounted(() => {
  observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        visible.value = true;
        observer?.disconnect();
        observer = undefined;
      }
    },
    // 提前 200px 开始加载，滚动到评论区附近即可无缝呈现
    { rootMargin: "200px" }
  );
  observer.observe(root.value!);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <!-- teek 通过 giscusContext 渲染此组件并透传 repo/theme 等全部 props，这里原样转发 -->
  <div ref="root">
    <Giscus v-if="visible" v-bind="$attrs" />
  </div>
</template>
