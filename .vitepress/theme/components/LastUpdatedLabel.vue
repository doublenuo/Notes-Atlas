<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vitepress';
import {
  formatUnixDate,
  normalizeRouteToKey,
  readLastUpdatedMap
} from '../utils/last-updated.mjs';

const route = useRoute();
const text = ref('');
const errorText = ref('');

const visible = computed(() => route.path !== '/');

async function refresh() {
  if (!visible.value) {
    text.value = '';
    errorText.value = '';
    return;
  }

  try {
    errorText.value = '';
    const map = await readLastUpdatedMap();
    const key = normalizeRouteToKey(route.path);
    if (!map[key]) {
      text.value = '';
      return;
    }
    text.value = `最新更新时间: ${formatUnixDate(map[key])}`;
  } catch (error) {
    text.value = '';
    errorText.value = `更新时间不可用: ${error.message}`;
  }
}

onMounted(refresh);
watch(() => route.path, refresh);
</script>

<template>
  <blockquote v-if="text" class="notes-meta">
    {{ text }}
  </blockquote>
  <blockquote v-else-if="errorText" class="notes-meta">
    {{ errorText }}
  </blockquote>
</template>

