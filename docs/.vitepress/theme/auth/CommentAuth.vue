<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { maskEmail } from './client'
import { useAuth } from './useAuth'

const { user, ready, openLogin } = useAuth()
const maskedEmail = computed(() => (user.value ? maskEmail(user.value.email) : ''))
const avatarFailed = ref(false)

watch(
  () => user.value?.avatarUrl,
  () => {
    avatarFailed.value = false
  },
)
</script>

<template>
  <div class="weno-comment-auth" aria-live="polite">
    <div v-if="!ready" class="weno-comment-auth__checking">
      <span class="weno-comment-auth__dot" aria-hidden="true" />
      正在检查登录状态…
    </div>

    <div v-else-if="!user" class="weno-comment-auth__card">
      <span class="weno-comment-auth__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M4.8 20c.7-3.4 3.2-5.2 7.2-5.2s6.5 1.8 7.2 5.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </span>
      <div class="weno-comment-auth__copy">
        <strong>登录后参与评论</strong>
        <p>一次登录，全站通用</p>
      </div>
      <button type="button" @click="openLogin('登录后即可评论')">登录</button>
    </div>

    <div v-else class="weno-comment-auth__identity">
      <img
        v-if="user.avatarUrl && !avatarFailed"
        class="weno-comment-auth__avatar weno-comment-auth__avatar--img"
        :src="user.avatarUrl"
        alt=""
        referrerpolicy="no-referrer"
        @error="avatarFailed = true"
      />
      <span v-else class="weno-comment-auth__avatar" aria-hidden="true">
        {{ user.nick.slice(0, 1) }}
      </span>
      <div>
        <strong>{{ user.nick }}</strong>
        <span>{{ maskedEmail }}</span>
      </div>
    </div>
  </div>
</template>
