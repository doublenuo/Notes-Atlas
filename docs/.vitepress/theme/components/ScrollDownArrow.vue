<script setup lang="ts">
const ns = "scroll-down-arrow";

/** 平滑滚动到 Banner 下方的内容区（首页卡片栏 / 文章列表） */
const scrollToContent = () => {
  // .tk-banner 为首页 Banner 根元素（is-full-img 时高度即一屏）；取不到时退回滚动一屏
  const banner = document.querySelector<HTMLElement>(".tk-banner");
  const top = banner ? banner.getBoundingClientRect().bottom + window.scrollY : window.innerHeight;
  window.scrollTo({ top, behavior: "smooth" });
};
</script>

<template>
  <div :class="[ns, 'flx-column-center']">
    <button
      :class="`${ns}__btn`"
      type="button"
      aria-label="向下滚动，查看首页内容"
      @click="scrollToContent"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" aria-hidden="true">
        <path
          fill="currentColor"
          d="M831.872 340.864 512 652.672 192.128 340.864a30.592 30.592 0 0 0-42.752 0 29.12 29.12 0 0 0 0 41.6L489.664 714.24a32 32 0 0 0 44.672 0l340.288-331.712a29.12 29.12 0 0 0 0-41.728 30.592 30.592 0 0 0-42.752 0z"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
$namespace: scroll-down-arrow;

// 贴近 Banner 底边：内容层 .tk-banner__content 为 relative 且高 100vh，
// 以其为定位上下文把箭头钉在底部（is-full-img 时即视口底部）
.#{$namespace} {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #fff;
    cursor: pointer;
    transition: opacity 0.3s ease;

    svg {
      width: 36px;
      height: 36px;
      animation: #{$namespace}-bounce 1.6s ease-in-out infinite;
    }

    &:hover {
      opacity: 0.75;
    }
  }
}

@keyframes #{$namespace}-bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(7px);
  }
}
</style>
