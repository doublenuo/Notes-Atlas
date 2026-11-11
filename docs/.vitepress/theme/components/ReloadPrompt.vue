<script setup lang="ts">
import { onBeforeMount, ref } from 'vue'

const offlineReady = ref(false)
const needRefresh = ref(false)
let updateServiceWorker: (() => Promise<void>) | undefined

function onOfflineReady() {
  offlineReady.value = true
}
function onNeedRefresh() {
  needRefresh.value = true
}
function close() {
  offlineReady.value = false
  needRefresh.value = false
}
function reload() {
  updateServiceWorker?.()
}

// VitePress 是 SSG：setup 会在服务端执行一次，virtual:pwa-register 只能在客户端
// 动态 import（onBeforeMount 在 SSR 阶段不会触发）。顶层静态 import 会破坏构建。
onBeforeMount(async () => {
  const { registerSW } = await import('virtual:pwa-register')
  updateServiceWorker = registerSW({
    immediate: true,
    onOfflineReady,
    onNeedRefresh,
    onRegistered() {
      console.info('[PWA] Service Worker registered')
    },
    onRegisterError(e) {
      console.error('[PWA] Service Worker registration failed', e)
    },
  })
})
</script>

<template>
  <div
    v-if="offlineReady || needRefresh"
    class="pwa-toast"
    role="alertdialog"
    aria-labelledby="pwa-toast-message"
    data-pagefind-ignore
  >
    <div id="pwa-toast-message" class="pwa-toast__message">
      {{ needRefresh ? '站点有新内容，点击刷新后生效。' : '已就绪，可离线阅读已浏览过的页面。' }}
    </div>
    <div class="pwa-toast__actions">
      <button v-if="needRefresh" type="button" class="pwa-toast__btn pwa-toast__btn--primary" @click="reload">
        刷新
      </button>
      <button type="button" class="pwa-toast__btn" @click="close">关闭</button>
    </div>
  </div>
</template>

<style scoped>
.pwa-toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 999;
  max-width: min(360px, calc(100vw - 32px));
  padding: 14px 16px;
  border: 1px solid var(--vp-c-divider, rgba(60, 60, 67, .18));
  border-radius: 12px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-1, #213547);
  box-shadow: 0 10px 32px rgba(0, 0, 0, .16);
  font: 14px/1.6 var(--vp-font-family-base, system-ui, sans-serif);
}
.pwa-toast__message {
  margin-bottom: 12px;
}
.pwa-toast__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.pwa-toast__btn {
  padding: 5px 14px;
  border: 1px solid var(--vp-c-divider, rgba(60, 60, 67, .18));
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.pwa-toast__btn:hover {
  border-color: var(--vp-c-brand-1, #3451b2);
}
.pwa-toast__btn--primary {
  border-color: var(--vp-c-brand-1, #3451b2);
  background: var(--vp-c-brand-1, #3451b2);
  color: #fff;
}
.pwa-toast__btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1, #3451b2);
  outline-offset: 2px;
}
@media print {
  .pwa-toast { display: none; }
}
</style>
