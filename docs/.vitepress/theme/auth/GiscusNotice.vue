<script setup lang="ts">
const configured = Boolean(
  import.meta.env.VITE_GISCUS_REPO &&
    import.meta.env.VITE_GISCUS_REPO_ID &&
    import.meta.env.VITE_GISCUS_CATEGORY &&
    import.meta.env.VITE_GISCUS_CATEGORY_ID,
)
</script>

<template>
  <div v-if="!configured" class="weno-giscus-notice" role="status">
    <strong>GitHub Pages 评论区待配置</strong>
    <p>
      这个镜像站的评论使用 giscus。请在仓库 Variables 中设置
      <code>GISCUS_REPO</code>、<code>GISCUS_REPO_ID</code>、<code>GISCUS_CATEGORY</code>、
      <code>GISCUS_CATEGORY_ID</code> 后重新构建；主站评论不受影响。
    </p>
  </div>
</template>
