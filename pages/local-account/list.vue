<template>
  <view class="local-page">
    <AppNavBar title="本机普通账号" :show-back="true" />
    <view class="section" v-if="accounts.length">
      <view
        v-for="item in accounts"
        :key="item.user_id"
        class="account-item card section"
        @longpress="confirmDelete(item)"
      >
        <view class="info">
          <image v-if="item.avatar_url" class="avatar" :src="item.avatar_url" mode="aspectFill" />
          <view v-else class="avatar placeholder">{{ avatarText(item.nickname) }}</view>
          <view class="meta">
            <text class="name">{{ item.nickname }}</text>
            <text class="date">上次：{{ formatDate(item.last_login_at) }}</text>
          </view>
        </view>
        <button class="mini" :loading="loadingId === item.user_id" @tap="loginAccount(item)">登录</button>
      </view>
    </view>
    <view v-else class="empty">暂无普通账号，请创建</view>

    <button class="primary" @tap="toCreate">新建普通账号</button>

    <view class="hint">长按账号可删除，仅删除本机记录。</view>
    <view v-if="errMsg" class="error">{{ errMsg }}</view>
  </view>
</template>

<script setup>
import { ref, onShow } from 'vue'
import AppNavBar from '../../components/AppNavBar.vue'
import { getLocalAccounts, removeLocalAccount, setCurrentAccountId } from '../../utils/local-account.js'
import { loginLocalAccount } from '../../utils/auth.js'
import { guessPlatformScene } from '../../utils/platform.js'

const accounts = ref([])
const loadingId = ref('')
const errMsg = ref('')

onShow(() => {
  load()
})

function load() {
  accounts.value = getLocalAccounts()
}

async function loginAccount(item) {
  if (!item || !item.user_id) return
  errMsg.value = ''
  loadingId.value = item.user_id
  try {
    await loginLocalAccount({ userId: item.user_id, platform: guessPlatformScene() })
    setCurrentAccountId(item.user_id)
    uni.showToast({ title: '登录成功', icon: 'success' })
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (err) {
    errMsg.value = err?.message || '登录失败'
    uni.showToast({ title: errMsg.value, icon: 'none' })
  } finally {
    loadingId.value = ''
  }
}

function toCreate() {
  uni.navigateTo({ url: '/pages/local-account/create' })
}

function confirmDelete(item) {
  uni.showModal({
    title: '删除账号',
    content: `确认删除“${item.nickname}”？此操作仅影响本机缓存`,
    success: (res) => {
      if (res.confirm) {
        removeLocalAccount(item.user_id)
        load()
      }
    },
  })
}

function avatarText(name = '') {
  return (String(name).trim() || 'U').slice(0, 1).toUpperCase()
}

function formatDate(ts) {
  if (!ts) return '从未登录'
  try {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch (_) {
    return '未知'
  }
}
</script>

<style scoped>
.local-page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f8fafc;
  box-sizing: border-box;
}
.section {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
}
.info {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #cbd5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
}
.placeholder {
  color: #0f172a;
}
.meta {
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 32rpx;
  font-weight: 600;
}
.date {
  font-size: 26rpx;
  color: #64748b;
}
.primary {
  margin-top: 40rpx;
  height: 96rpx;
  border-radius: 20rpx;
  background: linear-gradient(90deg, #4f46e5, #0ea5e9);
  color: #fff;
  border: none;
  font-size: 32rpx;
}
.empty {
  margin-top: 32rpx;
  text-align: center;
  color: #94a3b8;
}
.hint {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: #94a3b8;
}
.error {
  margin-top: 20rpx;
  color: #dc2626;
  font-size: 26rpx;
}
</style>
