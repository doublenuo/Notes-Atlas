<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AuthApiError, maskEmail } from './client'
import { useAuth } from './useAuth'

const { user, ready, notice, openLogin, logout, changeNick, clearNotice } = useAuth()

const root = ref<HTMLElement | null>(null)
const menuOpen = ref(false)
const editMode = ref(false)
const nickDraft = ref('')
const saving = ref(false)
const saveError = ref('')
const avatarFailed = ref(false)
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const initials = computed(() => (user.value?.nick || '?').trim().slice(0, 1).toUpperCase())
const maskedEmail = computed(() => (user.value ? maskEmail(user.value.email) : ''))
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

function toggleMenu() {
  if (!user.value) return
  menuOpen.value = !menuOpen.value
  if (!menuOpen.value) {
    editMode.value = false
    saveError.value = ''
  }
}

function startEdit() {
  nickDraft.value = user.value?.nick || ''
  editMode.value = true
  saveError.value = ''
  void nextTick(() => {
    const input = root.value?.querySelector<HTMLInputElement>('.weno-auth-nav__nick-input')
    input?.focus()
    input?.select()
  })
}

async function saveNick() {
  if (saving.value) return
  const value = nickDraft.value.trim()
  if (!value) {
    saveError.value = '昵称不能为空'
    return
  }
  if (Array.from(value).length > 20) {
    saveError.value = '昵称最多 20 个字符'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    await changeNick(value)
    editMode.value = false
  } catch (error) {
    saveError.value = error instanceof AuthApiError ? error.message : '昵称保存失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

async function signOut() {
  menuOpen.value = false
  editMode.value = false
  try {
    await logout()
  } catch {
    // logout 内部已清理本地登录态；网络失败不阻塞界面
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!menuOpen.value) return
  if (root.value && !root.value.contains(event.target as Node)) {
    menuOpen.value = false
    editMode.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    editMode.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onKeydown)
  if (noticeTimer) clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="weno-auth-nav">
    <span v-if="!ready" class="weno-auth-nav__skeleton" aria-hidden="true" />

    <button v-else-if="!user" class="weno-auth-nav__login" type="button" @click="openLogin()">
      登录
    </button>

    <div v-else ref="root" class="weno-auth-nav__account">
      <button
        class="weno-auth-nav__trigger"
        type="button"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        :aria-label="`账号：${user.nick}`"
        @click="toggleMenu"
      >
        <img
          v-if="avatar"
          class="weno-auth-nav__avatar"
          :src="avatar"
          alt=""
          referrerpolicy="no-referrer"
          @error="avatarFailed = true"
        />
        <span v-else class="weno-auth-nav__avatar weno-auth-nav__avatar--fallback">{{ initials }}</span>
        <span class="weno-auth-nav__name">{{ user.nick }}</span>
      </button>

      <Transition name="weno-auth-pop">
        <div v-if="menuOpen" class="weno-auth-nav__menu" role="menu">
          <div class="weno-auth-nav__identity">
            <strong>{{ user.nick }}</strong>
            <span>{{ maskedEmail }}</span>
            <span class="weno-auth-nav__verified">邮箱已验证</span>
          </div>

          <form v-if="editMode" class="weno-auth-nav__edit" @submit.prevent="saveNick">
            <label>
              <span>新昵称</span>
              <input
                v-model="nickDraft"
                class="weno-auth-nav__nick-input"
                type="text"
                maxlength="20"
                autocomplete="nickname"
                @input="saveError = ''"
              />
            </label>
            <p class="weno-auth-nav__hint">1–20 个字符，只影响之后的新评论。</p>
            <p v-if="saveError" class="weno-auth-nav__error" role="alert">{{ saveError }}</p>
            <div class="weno-auth-nav__edit-actions">
              <button type="button" :disabled="saving" @click="editMode = false">取消</button>
              <button type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
            </div>
          </form>

          <template v-else>
            <button class="weno-auth-nav__item" type="button" role="menuitem" @click="startEdit">
              修改昵称
            </button>
            <button class="weno-auth-nav__item" type="button" role="menuitem" @click="signOut">
              退出登录
            </button>
          </template>
        </div>
      </Transition>
    </div>

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
