<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import { useAuth } from './useAuth'

const { user, ready, notice, openLogin, clearNotice } = useAuth()

const avatarFailed = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const initials = computed(() => (user.value?.nick || '?').trim().slice(0, 1).toUpperCase())
const avatar = computed(() => (avatarFailed.value ? '' : user.value?.avatarUrl || ''))

watch(
  () => user.value?.avatarUrl,
  () => {
    avatarFailed.value = false
  },
)

watch(notice, (value) => {
  if (noticeTimer) clearTimeout(noticeTimer)
  if (!value) return
  noticeTimer = setTimeout(() => clearNotice(), 6000)
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="weno-auth-nav">
    <span v-if="!ready" class="weno-auth-nav__skeleton" aria-hidden="true" />

    <button v-else-if="!user" class="weno-auth-nav__login" type="button" @click="openLogin()">
      登录
    </button>

    <a
      v-else
      class="weno-auth-nav__trigger"
      :href="withBase('/profile')"
      :aria-label="`个人中心：${user.nick}`"
      title="个人中心"
    >
      <img
        v-if="avatar"
        class="weno-auth-nav__avatar"
        :src="avatar"
        alt=""
        referrerpolicy="no-referrer"
        @error="avatarFailed = true"
      />
      <span v-else class="weno-auth-nav__avatar weno-auth-nav__avatar--fallback" aria-hidden="true">
        {{ initials }}
      </span>
      <span class="weno-auth-nav__name">{{ user.nick }}</span>
    </a>

    <Teleport to="body">
      <Transition name="weno-auth-fade">
        <div v-if="notice" class="weno-auth-toast" role="status">
          <span>{{ notice }}</span>
          <button type="button" aria-label="关闭提示" @click="clearNotice">×</button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
