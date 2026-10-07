<template>
  <view class="entry">
    <AppNavBar title="24 点" :show-back="false" />
    <view class="entry-body">
      <text class="eyebrow">TWENTY FOUR</text>
      <text class="hero">四张纸牌，
无限可能。</text>
      <text class="intro">用加减乘除，让答案成为 24。</text>

      <view class="mode-card">
        <view class="section-head">
          <text class="card-title">在线挑战</text>
          <text v-if="accountState === 'bound'" class="account-count">微信已绑定</text>
        </view>
        <view v-if="accountState === 'checking'" class="account-empty">
          <text class="copy">正在确认当前微信身份…</text>
        </view>
        <view v-else-if="accountState === 'error'" class="account-empty">
          <text class="empty-title">暂时无法确认帐号状态</text>
          <text class="copy">联网后可重新检查；也可直接开始本地练习。</text>
        </view>
        <view v-else-if="accountState === 'bound' && linkedAccount" class="account-list">
          <view class="account-row selected">
            <image v-if="linkedAccount.avatar" class="account-avatar" :src="linkedAccount.avatar" mode="aspectFill" />
            <view v-else class="account-avatar avatar-fallback">{{ (linkedAccount.name || '玩').slice(0, 1) }}</view>
            <view class="account-info">
              <text class="account-name">{{ linkedAccount.name || '微信玩家' }}</text>
              <text class="account-last">当前微信身份已关联</text>
            </view>
            <view class="account-radio"></view>
          </view>
        </view>
        <view v-else class="account-empty">
          <text class="empty-title">首次使用在线挑战</text>
          <text class="copy">新建帐号后，可在帐号页面修改用户名和头像。</text>
        </view>
        <text v-if="accountState === 'bound'" class="account-hint">此微信身份已关联唯一在线帐号，使用该微信登录即可恢复资料和答题记录。</text>
        <text v-else-if="accountState === 'unbound'" class="account-hint">帐号由当前微信身份认证，不需要密码。</text>
        <button
          v-if="accountState === 'bound'"
          class="primary"
          :loading="busy"
          :disabled="busy"
          @tap="enterSelectedAccount"
        >
          登录
        </button>
        <button
          v-else-if="accountState === 'unbound'"
          class="secondary"
          :loading="busy"
          :disabled="busy"
          @tap="openProfile"
        >
          ＋　新建帐号
        </button>
        <button
          v-else-if="accountState === 'error'"
          class="secondary"
          :loading="busy"
          :disabled="busy"
          @tap="refreshLoginPage"
        >
          重新检查
        </button>
        <text v-if="error" class="error">{{ error }}</text>
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

      <text class="foot">在线成绩从微信身份登录后开始累计。本地练习数据与在线帐号相互独立。</text>
      <text class="build-meta">v{{ appVersion }} · 构建时间 {{ buildTime }}</text>
    </view>

    <view v-if="profileOpen" class="modal-mask">
      <view class="profile-modal">
        <text class="modal-title">确认在线帐号资料</text>
        <text class="modal-copy">填写资料创建帐号后，可在“我的资料”修改用户名和头像。确认时会核对当前微信身份是否已关联帐号。</text>
        <button
          class="avatar-picker"
          open-type="chooseAvatar"
          @chooseavatar="onChooseAvatar"
        >
          <image v-if="profileAvatar" class="profile-avatar" :src="profileAvatar" mode="aspectFill" />
          <view v-else class="profile-avatar-placeholder">头像</view>
          <text class="avatar-caption">点击选择微信头像</text>
        </button>
        <button class="avatar-album-button" @tap="chooseAvatarFromAlbum">或从相册选择头像</button>
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
          确认并创建
        </button>
        <button class="cancel-button" :disabled="busy" @tap="cancelProfile">暂不登录</button>
      </view>
    </view>
  </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import { ensureInit, readStats } from '../../utils/store.js'
import { loginOnline, checkOnlineAccount, createOnlineAccount, saveProfile, enterPractice } from '../../utils/online.js'
ensureInit()
const busy = ref(false),
  error = ref(''),
  practiceStats = ref(readStats())
const accountState = ref('checking')
const linkedAccount = ref(null)
const selectedAccountId = ref('')
const appVersion = __TF24_APP_VERSION__
function formatBuildTime(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '未知'
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const buildTime = formatBuildTime(__TF24_BUILD_TIME__)
async function refreshLoginPage() {
  practiceStats.value = readStats()
  accountState.value = 'checking'
  error.value = ''
  try {
    const status = await checkOnlineAccount()
    if (status.linked && status.user) {
      linkedAccount.value = status.user
      selectedAccountId.value = status.user.id
      accountState.value = 'bound'
    } else {
      linkedAccount.value = null
      selectedAccountId.value = ''
      accountState.value = 'unbound'
    }
  } catch (e) {
    linkedAccount.value = null
    selectedAccountId.value = ''
    accountState.value = 'error'
    error.value = e.message || '无法确认微信帐号状态，请联网后重试'
  }
}
onShow(refreshLoginPage)
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
async function enterSelectedAccount() {
  if (busy.value || !selectedAccountId.value) return
  const expectedId = selectedAccountId.value
  busy.value = true
  error.value = ''
  try {
    const user = await loginOnline()
    if (user.id !== expectedId) {
      enterPractice()
      error.value = '当前微信身份与所选帐号不匹配。请切换到绑定该帐号的微信身份后重试。'
      return
    }
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (e) {
    error.value = e.message || '登录失败，请重试'
  } finally {
    busy.value = false
  }
}
async function openProfile() {
  if (busy.value || accountState.value !== 'unbound') return
  busy.value = true
  error.value = ''
  try {
    const status = await checkOnlineAccount()
    if (status.linked && status.user) {
      linkedAccount.value = status.user
      selectedAccountId.value = status.user.id
      accountState.value = 'bound'
      error.value = '当前微信身份已关联帐号，已切换为登录入口。'
      return
    }
    profileName.value = '微信玩家'
    profileAvatar.value = ''
    originalName.value = profileName.value
    originalAvatar.value = ''
    profileOpen.value = true
  } catch (e) {
    accountState.value = 'error'
    error.value = e.message || '无法核对微信帐号状态，请联网后重试'
  } finally {
    busy.value = false
  }
}
function onChooseAvatar(e) {
  profileAvatar.value = e?.detail?.avatarUrl || ''
}
function chooseAvatarFromAlbum() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album'],
    success: (result) => {
      profileAvatar.value = result.tempFilePaths?.[0] || profileAvatar.value
    },
  })
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
    await createOnlineAccount(name)
    if (profileAvatar.value && profileAvatar.value !== originalAvatar.value) {
      try {
        await saveProfile(name, profileAvatar.value)
      } catch (_) {
        error.value = '帐号已创建，头像暂未保存，可进入后在用户页面修改。'
      }
    }
    profileOpen.value = false
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (e) {
    if (String(e.message || '').includes('已经关联在线帐号')) {
      try {
        const status = await checkOnlineAccount()
        if (status.linked && status.user) {
          linkedAccount.value = status.user
          selectedAccountId.value = status.user.id
          accountState.value = 'bound'
          profileOpen.value = false
          error.value = '当前微信身份已关联帐号，已切换为登录入口。'
        } else {
          error.value = e.message
        }
      } catch (_) {
        error.value = e.message
      }
    } else {
      error.value = e.message || '帐号创建失败，请重试'
    }
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
.build-meta {
  display: block;
  margin: 34rpx 0 8rpx;
  color: #a0a79f;
  font-size: 20rpx;
  line-height: 1.5;
  text-align: center;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.account-count {
  color: #738077;
  background: #eff1e8;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
}
.account-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}
.account-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border: 1rpx solid #d9ded2;
  border-radius: 20rpx;
  background: #fffefa;
}
.account-row.selected {
  border-color: #275c48;
  box-shadow: 0 0 0 2rpx rgba(39, 92, 72, .08);
}
.account-avatar {
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  border-radius: 50%;
}
.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(145deg, #82a899, #446f60);
  font-size: 34rpx;
  font-weight: 700;
}
.account-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.account-name {
  color: #253c34;
  font-size: 27rpx;
  font-weight: 700;
}
.account-last {
  margin-top: 7rpx;
  color: #738077;
  font-size: 20rpx;
}
.account-radio {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #c5c9bf;
  border-radius: 50%;
}
.account-row.selected .account-radio {
  border: 8rpx solid #275c48;
}
.account-hint {
  display: block;
  margin-top: 18rpx;
  color: #738077;
  font-size: 21rpx;
  line-height: 1.55;
}
.account-empty {
  margin-top: 16rpx;
  padding: 26rpx 18rpx;
  border-radius: 18rpx;
  background: #f5f3e9;
  text-align: center;
}
.empty-title {
  display: block;
  color: #253c34;
  font-size: 24rpx;
  font-weight: 650;
}
.secondary {
  background: #e8ecdf;
  color: #275c48;
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
  padding: 24rpx;
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
.avatar-album-button {
  display: inline-block;
  margin: 8rpx 0 0 132rpx;
  padding: 0;
  border: none;
  background: transparent;
  color: #275c48;
  font-size: 22rpx;
  line-height: 1.5;
}
.avatar-album-button::after { border: none; }
.avatar-caption, .field-label {
  color: #253c34;
  font-size: 25rpx;
  font-weight: 600;
}
.field-label { display: block; margin-top: 18rpx; }
.nickname-input {
  box-sizing: border-box;
  width: 100%;
  height: 88rpx;
  margin-top: 12rpx;
  padding: 18rpx 14rpx;
  border: 1rpx solid #d9ded2;
  border-radius: 14rpx;
  color: #253c34;
  background: #f7f6ef;
  font-size: 24rpx;
  line-height: 48rpx;
  white-space: nowrap;
}
.privacy-copy { margin-top: 14rpx; font-size: 21rpx; }
.modal-error { display: block; margin-top: 14rpx; color: #a34036; font-size: 23rpx; }
.confirm-button { margin-top: 22rpx; }
.cancel-button { margin-top: 8rpx; background: transparent; color: #738077; }
</style>
