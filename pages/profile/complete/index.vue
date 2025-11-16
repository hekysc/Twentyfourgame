<template>
  <view class="complete-page" :style="pageStyle">
    <AppNavBar title="完善资料" :show-back="true" :with-safe-top="false" />
    <view class="complete-body">
      <view class="intro">
        <text class="intro-title">完善资料后即可开始游戏</text>
        <text class="intro-sub">只需选择头像与昵称，我们仅用于本地展示</text>
      </view>

      <view class="card">
        <view class="section-title">头像</view>
        <view class="avatar-row">
          <image v-if="avatarPreview" class="avatar-preview" :src="avatarPreview" mode="aspectFill" />
          <view v-else class="avatar-placeholder">+</view>
          <button
            v-if="isMpWeixin"
            class="btn-outline"
            open-type="chooseAvatar"
            @chooseavatar="handleChooseAvatar"
          >选择头像</button>
          <button
            v-else
            class="btn-outline"
            @tap="chooseAvatarFallback"
          >选择头像</button>
        </view>
      </view>

      <view class="card">
        <view class="section-title">昵称</view>
        <input
          class="nickname-input"
          type="nickname"
          v-model="nickname"
          maxlength="20"
          placeholder="请输入昵称"
          confirm-type="done"
        />
      </view>

      <button class="submit-btn" :disabled="submitting" @tap="submitProfile">
        {{ submitting ? '提交中...' : '保存并继续' }}
      </button>
    </view>

    <view
      v-if="hintState.visible"
      class="floating-hint-layer"
      :class="{ interactive: hintState.interactive }"
      @tap="hideHint"
    >
      <view class="floating-hint" @tap.stop>{{ hintState.text }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppNavBar from '../../../components/AppNavBar.vue'
import { getCurrentUser, updateUserProfile } from '../../../utils/cloud-store.js'
import { useFloatingHint } from '../../../utils/hints.js'
import { useSafeArea } from '../../../utils/useSafeArea.js'

const currentUser = ref(null)
const nickname = ref('')
const avatarPreview = ref('')
const avatarTempPath = ref('')
const submitting = ref(false)

const { hintState, showHint, hideHint } = useFloatingHint()
const { safeTop } = useSafeArea()
const pageStyle = computed(() => ({
  paddingTop: `${Math.max(0, safeTop.value || 0)}px`
}))

const isMpWeixin = computed(() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
})

onMounted(() => {
  initUser()
})

onShow(() => {
  initUser()
})

async function initUser() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      showHint('请先登录后再完善资料', { duration: 2000 })
      setTimeout(() => goLogin(), 1200)
      return
    }
    currentUser.value = user
    if (user.profile_completed && (user.nickname || '').trim() && (user.avatar_url || '').trim()) {
      goHome()
      return
    }
    nickname.value = (user.nickname || '').trim()
    avatarPreview.value = user.avatar_url || ''
  } catch (err) {
    console.error('加载用户信息失败:', err)
    showHint('加载用户信息失败', { duration: 2000 })
  }
}

function handleChooseAvatar(event) {
  const url = event?.detail?.avatarUrl
  if (!url) {
    showHint('未选择头像', { duration: 1500 })
    return
  }
  avatarPreview.value = url
  avatarTempPath.value = url
}

function chooseAvatarFallback() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      const path = (res.tempFilePaths && res.tempFilePaths[0]) || ''
      if (path) {
        avatarPreview.value = path
        avatarTempPath.value = path
      }
    },
    fail: () => {
      showHint('选择头像失败', { duration: 1500 })
    }
  })
}

async function submitProfile() {
  if (submitting.value) return
  if (!currentUser.value) {
    showHint('请先登录', { duration: 2000 })
    return
  }
  const name = nickname.value.trim()
  if (!name) {
    showHint('请输入昵称', { duration: 2000 })
    return
  }
  const avatarSource = avatarTempPath.value || avatarPreview.value
  if (!avatarSource) {
    showHint('请选择头像', { duration: 2000 })
    return
  }
  submitting.value = true
  try {
    const uploaded = await uploadAvatarToCloud(avatarSource)
    await updateUserProfile({
      nickname: name,
      avatar_url: uploaded.url,
      avatar_file_id: uploaded.fileID
    })
    showHint('资料已更新', { duration: 1800 })
    setTimeout(() => goHome(), 800)
  } catch (err) {
    console.error('保存资料失败:', err)
    showHint(err?.message || '保存失败，请重试', { duration: 2000 })
  } finally {
    submitting.value = false
  }
}

async function uploadAvatarToCloud(filePath) {
  const userId = currentUser.value?._id || currentUser.value?.id || 'anonymous'
  const ext = filePath.split('.').pop() || 'jpg'
  const cloudPath = `avatars/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const res = await uniCloud.uploadFile({
    filePath,
    cloudPath
  })
  const fileID = res?.fileID || res?.file_id
  if (!fileID) {
    throw new Error('上传头像失败')
  }
  return { fileID, url: fileID }
}

function goHome() {
  try {
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (_) {
    try { uni.navigateTo({ url: '/pages/index/index' }) } catch (_) {}
  }
}

function goLogin() {
  try {
    uni.reLaunch({ url: '/pages/login/index' })
  } catch (_) {
    try { uni.navigateTo({ url: '/pages/login/index' }) } catch (_) {}
  }
}
</script>

<style scoped>
@import '@/styles/common.css';

.complete-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #e0f2fe 0%, #f5f3ff 100%);
}

.complete-body {
  padding: 40rpx 32rpx 80rpx;
}

.intro {
  margin-bottom: 40rpx;
  text-align: center;
}

.intro-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #1f2937;
}

.intro-sub {
  display: block;
  margin-top: 12rpx;
  font-size: 28rpx;
  color: #6b7280;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.08);
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #111827;
  margin-bottom: 20rpx;
}

.avatar-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.avatar-preview,
.avatar-placeholder {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 60rpx;
  color: #94a3b8;
}

.avatar-preview {
  background: #dbeafe;
}

.btn-outline {
  padding: 20rpx 36rpx;
  border-radius: 999rpx;
  border: 2rpx solid #2563eb;
  color: #2563eb;
  font-size: 28rpx;
  background: #fff;
}

.nickname-input {
  width: 100%;
  height: 90rpx;
  border-radius: 16rpx;
  border: 2rpx solid #e5e7eb;
  padding: 0 24rpx;
  font-size: 32rpx;
  background: #fdfdfd;
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  border-radius: 48rpx;
  background: linear-gradient(120deg, #2563eb, #0ea5e9);
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 40rpx;
}

.submit-btn:disabled {
  opacity: 0.6;
}

.floating-hint-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.floating-hint-layer.interactive {
  pointer-events: auto;
}

.floating-hint-layer .floating-hint {
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 24rpx 40rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  max-width: 80%;
  text-align: center;
}
</style>
