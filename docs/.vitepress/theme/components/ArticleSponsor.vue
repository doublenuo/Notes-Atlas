<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const visible = computed(() => frontmatter.value.article !== false)
const expanded = ref(false)
</script>

<template>
  <div v-if="visible" class="article-sponsor" aria-label="打赏支持">
    <button
      class="article-sponsor__link"
      type="button"
      :aria-expanded="expanded"
      aria-controls="article-sponsor-panel"
      @click="expanded = !expanded"
    >
      <img
        class="article-sponsor__image"
        src="https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261029123338921.png"
        alt="请作者喝杯咖啡"
      >
      <span class="article-sponsor__text">
        {{ expanded ? '收起打赏二维码' : '如果这篇文章对你有帮助，欢迎请我喝杯咖啡 ☕' }}
      </span>
    </button>
    <Teleport to="body">
      <Transition name="article-sponsor">
        <div
          v-if="expanded"
          id="article-sponsor-panel"
          class="article-sponsor__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-sponsor-title"
          @click.self="expanded = false"
        >
          <div class="article-sponsor__dialog">
            <button
              class="article-sponsor__close"
              type="button"
              aria-label="关闭打赏窗口"
              @click="expanded = false"
            >
              ×
            </button>
            <div class="article-sponsor__header">
              <span class="article-sponsor__sparkle">✦</span>
              <div>
                <h2 id="article-sponsor-title">请我喝杯咖啡</h2>
                <p>感谢你的支持，让分享与记录继续发生。</p>
              </div>
            </div>
            <div class="article-sponsor__methods">
              <div class="article-sponsor__method">
                <div class="article-sponsor__qrcode-wrap">
                  <img class="article-sponsor__qrcode" src="https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261029123144108.png" alt="支付宝收款二维码">
                </div>
                <span>支付宝</span>
              </div>
              <div class="article-sponsor__method">
                <div class="article-sponsor__qrcode-wrap">
                  <img class="article-sponsor__qrcode" src="https://picupload-1330431167.cos.ap-guangzhou.myqcloud.com/images/20261029123230345.png" alt="微信收款二维码">
                </div>
                <span>微信</span>
              </div>
            </div>
            <p class="article-sponsor__footer">扫码支持一下，祝你今天也有好心情 ☕</p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.article-sponsor {
  display: flex;
  justify-content: center;
  padding: 28px 20px 12px;
}

.article-sponsor__link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  padding: 10px 18px 10px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  transition: border-color 0.2s, color 0.2s, transform 0.2s;
}

.article-sponsor__link:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.article-sponsor__image {
  width: 42px;
  height: 42px;
  object-fit: contain;
  flex: 0 0 auto;
}

.article-sponsor__text {
  font-size: 14px;
}

.article-sponsor__overlay {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 48%);
  backdrop-filter: blur(6px);
}

.article-sponsor__dialog {
  position: relative;
  width: min(460px, 100%);
  padding: 32px 28px 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 24px;
  background: var(--vp-c-bg);
  box-shadow: 0 24px 80px rgb(15 23 42 / 24%);
  text-align: center;
}

.article-sponsor__close {
  position: absolute;
  top: 12px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  font-size: 25px;
  line-height: 1;
}

.article-sponsor__close:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.article-sponsor__header {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 10px;
  text-align: left;
}

.article-sponsor__sparkle {
  color: var(--vp-c-brand-1);
  font-size: 25px;
  line-height: 1.15;
}

.article-sponsor__header h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: 21px;
  font-weight: 650;
}

.article-sponsor__header p {
  margin: 6px 0 0;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.article-sponsor__methods {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 24px;
}

.article-sponsor__method {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.article-sponsor__qrcode-wrap {
  padding: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
}

.article-sponsor__qrcode {
  width: 160px;
  height: 160px;
  display: block;
  border-radius: 8px;
  object-fit: contain;
}

.article-sponsor__method > span {
  font-weight: 550;
}

.article-sponsor__footer {
  margin: 22px 0 0;
  color: var(--vp-c-text-3);
  font-size: 12px;
}

.article-sponsor-enter-active,
.article-sponsor-leave-active {
  transition: opacity 0.2s ease;
}

.article-sponsor-enter-active .article-sponsor__dialog,
.article-sponsor-leave-active .article-sponsor__dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.article-sponsor-enter-from,
.article-sponsor-leave-to {
  opacity: 0;
}

.article-sponsor-enter-from .article-sponsor__dialog,
.article-sponsor-leave-to .article-sponsor__dialog {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

@media (max-width: 640px) {
  .article-sponsor__text {
    font-size: 13px;
  }

  .article-sponsor__methods {
    gap: 12px;
  }

  .article-sponsor__qrcode {
    width: min(34vw, 140px);
    height: min(34vw, 140px);
  }

  .article-sponsor__dialog {
    padding: 30px 16px 20px;
  }
}
</style>
