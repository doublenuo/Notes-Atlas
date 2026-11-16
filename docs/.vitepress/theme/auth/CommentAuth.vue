<script setup lang="ts">
import { computed } from 'vue'
import { maskEmail } from './client'
import { useAuth } from './useAuth'

const { user, ready, openLogin } = useAuth()
const maskedEmail = computed(() => (user.value ? maskEmail(user.value.email) : ''))
</script>

<template>
  <div class="weno-comment-auth" aria-live="polite">
    <div v-if="!ready" class="weno-comment-auth__checking">
      <span class="weno-comment-auth__dot" aria-hidden="true" />
      正在检查登录状态…
    </div>

    <div v-else-if="!user" class="weno-comment-auth__card">
      <div>
        <strong>登录后参与评论</strong>
        <p>支持 GitHub 一键登录或邮箱验证码。一次登录，文章、留言板和朋友圈通用。</p>
      </div>
      <button type="button" @click="openLogin('登录后即可评论')">登录</button>
    </div>

    <div v-else class="weno-comment-auth__identity">
      <span class="weno-comment-auth__avatar" aria-hidden="true">{{ user.nick.slice(0, 1) }}</span>
      <div>
        <strong>以 {{ user.nick }} 评论</strong>
        <span>{{ maskedEmail }} · 邮箱已验证</span>
      </div>
    </div>
  </div>
</template>
