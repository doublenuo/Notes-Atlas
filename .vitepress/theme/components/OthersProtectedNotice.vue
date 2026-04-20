<script setup>
import { computed } from 'vue';
import { useRoute } from 'vitepress';

const route = useRoute();
const visible = computed(() => route.path.startsWith('/others'));
</script>

<template>
  <blockquote v-if="visible" class="notes-meta">
    该路径为受保护内容区域。生产环境请通过反向代理/网关启用鉴权（如 Basic Auth 或 SSO）。
  </blockquote>
</template>

