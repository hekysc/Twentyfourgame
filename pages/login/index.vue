<template>
  <view class="entry">
    <AppNavBar title="24 点" :show-back="false" />
    <view class="entry-body">
      <text class="eyebrow">TWENTY FOUR</text>
      <text class="hero">四张纸牌，
无限可能。</text>
      <text class="intro">用加减乘除，让答案成为 24。</text>

      <view class="mode-card">
        <text class="card-title">在线挑战</text>
        <text class="copy">微信身份用于登录和找回帐号。每个微信身份对应一个在线帐号，无需密码；首次登录后可选择或自定义头像和昵称。</text>
        <button class="primary" :loading="busy" :disabled="busy" @tap="openProfile">
          微信登录
        </button>
      </view>

      <view class="mode-card practice">
        <text class="card-title">本地练习</text>
        <text class="copy">无需帐号，无需联网。练习记录只留在本机。</text>
        <view class="practice-stats">
          <view class="stat-item">
            <text class="stat-value">{{ practiceTotal }}</text>
            <text class="stat-label">已完成</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ practiceRate }}%</text>
            <text class="stat-label">正确率</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ practiceAverage }}</text>
            <text class="stat-label">平均用时</text>
          </view>
        </view>
        <text v-if="!practiceTotal" class="empty-stats">还没有本地练习记录</text>
        <button :disabled="busy" @tap="practice">开始本地练习</button>
      </view>

      <text v-if="error" class="error">{{ error }}</text>
      <text class="foot">在线成绩从微信身份登录后开始累计。本地练习数据与在线帐号相互独立。</text>
    </view>

    <view v-if="profileOpen" class="modal-mask">
      <view class="profile-modal">
        <text class="modal-title">确认在线帐号资料</text>
        <text class="modal-copy">此微信身份对应一个在线帐号。选择微信头像和昵称，或自行设置；之后可在“用户”页面修改。</text>
        <button
          class="avatar-picker"
          open-type="chooseAvatar"
          @chooseavatar="onChooseAvatar"
        >
          <image v-if="profileAvatar" class="profile-avatar" :src="profileAvatar" mode="aspectFill" />
          <view v-else class="profile-avatar-placeholder">头像</view>
          <text class="avatar-caption">点击选择头像</text>
        </button>
        <text class="field-label">昵称</text>
        <input
          class="nickname-input"
          type="nickname"
          :value="profileName"
          maxlength="20"
          placeholder="使用微信昵称或自行填写"
          @input="profileName = $event.detail.value"
          @blur="profileName = $event.detail.value"
        />
        <text class="privacy-copy">排行榜本人可见完整昵称，其他人只看到首字和 *，不显示头像。</text>
        <text v-if="error" class="modal-error">{{ error }}</text>
        <button class="primary confirm-button" :loading="busy" :disabled="busy" @tap="confirmLogin">
          确认并登录
        </button>
        <button class="cancel-button" :disabled="busy" @tap="cancelProfile">暂不登录</button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import AppNavBar from '../../components/AppNavBar.vue'
import { ensureInit, readStats } from '../../utils/store.js'
import { loginOnline, saveProfile, enterPractice } from '../../utils/online.js'
ensureInit()
const busy = ref(false),
  error = ref(''),
  practiceStats = ref(readStats())
const practiceTotal = computed(() => Number(practiceStats.value?.totals?.total) || 0)
const practiceRate = computed(() => {
  const total = practiceTotal.value
  return total ? Math.round((100 * (Number(practiceStats.value?.totals?.success) || 0)) / total) : 0
})
const practiceAverage = computed(() => {
  const rounds = practiceStats.value?.rounds || []
  const completed = rounds.filter((round) => Number.isFinite(round.timeMs) && round.timeMs > 0)
  if (!completed.length) return '—'
  const average = completed.reduce((sum, round) => sum + round.timeMs, 0) / completed.length
  return average < 1000 ? (average / 1000).toFixed(1) + '秒' : Math.round(average / 1000) + '秒'
})
function practice() {
  enterPractice()
  uni.reLaunch({ url: '/pages/index/index' })
}
const profileOpen = ref(false),
  profileName = ref(''),
  profileAvatar = ref(''),
  originalName = ref(''),
  originalAvatar = ref('')
async function openProfile() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const user = await loginOnline()
    profileName.value = user.name || '微信玩家'
    profileAvatar.value = user.avatar || ''
    originalName.value = profileName.value
    originalAvatar.value = profileAvatar.value
    profileOpen.value = true
  } catch (e) {
    error.value = e.message || '登录失败，请重试'
  } finally {
    busy.value = false
  }
}
function onChooseAvatar(e) {
  profileAvatar.value = e?.detail?.avatarUrl || ''
}
function cancelProfile() {
  if (busy.value) return
  profileOpen.value = false
  enterPractice()
}
async function confirmLogin() {
  if (busy.value) return
  const name = profileName.value.trim()
  if (!name) {
    error.value = '请填写或选择一个昵称'
    return
  }
  busy.value = true
  error.value = ''
  try {
    if (name !== originalName.value || profileAvatar.value !== originalAvatar.value)
      await saveProfile(name, profileAvatar.value)
    profileOpen.value = false
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (e) {
    error.value = e.message || '资料保存失败，请修改后重试'
  } finally {
    busy.value = false
  }
}
</script>
<style scoped>
.entry {
  min-height: 100vh;
  background: #f7f3e8;
  color: #253c34;
}
.entry-body {
  padding: 56rpx 40rpx;
}
.eyebrow {
  display: block;
  color: #947747;
  font-size: 22rpx;
  letter-spacing: 6rpx;
}
.hero {
  display: block;
  white-space: pre-line;
  font-size: 64rpx;
  font-weight: 800;
  line-height: 1.3;
  margin: 22rpx 0;
}
.intro,
.copy,
.foot {
  display: block;
  color: #738077;
  line-height: 1.8;
  font-size: 26rpx;
  white-space: pre-line;
}
.mode-card {
  margin-top: 36rpx;
  padding: 32rpx;
  border: 1rpx solid #d9ded2;
  border-radius: 28rpx;
  background: #fffdf6;
}
.card-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}
button {
  margin-top: 26rpx;
  border-radius: 18rpx;
  font-size: 28rpx;
  background: #e8ecdf;
  color: #254d3e;
}
.primary {
  background: #275c48;
  color: white;
}
.practice-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 22rpx 8rpx;
  border-radius: 18rpx;
  background: #f5f3e9;
}
.stat-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
}
.stat-value {
  color: #275c48;
  font-size: 32rpx;
  font-weight: 700;
}
.stat-label, .empty-stats {
  margin-top: 8rpx;
  color: #738077;
  font-size: 22rpx;
}
.empty-stats {
  display: block;
  text-align: center;
}
.foot {
  margin-top: 32rpx;
  font-size: 23rpx;
  text-align: center;
}
.error {
  display: block;
  color: #a34036;
  padding-top: 24rpx;
}
.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36rpx;
  box-sizing: border-box;
  background: rgba(28, 40, 34, .48);
}
.profile-modal {
  width: 100%;
  padding: 36rpx 32rpx 28rpx;
  box-sizing: border-box;
  border: 1rpx solid #d9ded2;
  border-radius: 28rpx;
  background: #fffdf6;
  box-shadow: 0 24rpx 70rpx rgba(37, 60, 52, .2);
}
.modal-title {
  display: block;
  color: #253c34;
  font-size: 36rpx;
  font-weight: 800;
}
.modal-copy, .privacy-copy {
  display: block;
  margin-top: 12rpx;
  color: #738077;
  font-size: 23rpx;
  line-height: 1.65;
}
.avatar-picker {
  display: flex;
  align-items: center;
  gap: 20rpx;
  width: 100%;
  margin: 26rpx 0 16rpx;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
}
.avatar-picker::after { border: none; }
.profile-avatar, .profile-avatar-placeholder {
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  border-radius: 50%;
}
.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #275c48;
  background: #e8ecdf;
  font-size: 24rpx;
}
.avatar-caption, .field-label {
  color: #253c34;
  font-size: 25rpx;
  font-weight: 600;
}
.field-label { display: block; margin-top: 18rpx; }
.nickname-input {
  box-sizing: border-box;
  width: 100%;
  margin-top: 12rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid #d9ded2;
  border-radius: 14rpx;
  color: #253c34;
  background: #f7f6ef;
  font-size: 27rpx;
}
.privacy-copy { margin-top: 14rpx; font-size: 21rpx; }
.modal-error { display: block; margin-top: 14rpx; color: #a34036; font-size: 23rpx; }
.confirm-button { margin-top: 22rpx; }
.cancel-button { margin-top: 8rpx; background: transparent; color: #738077; }
</style>
