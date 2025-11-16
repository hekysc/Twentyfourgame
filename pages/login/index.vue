<template>
  <view class="login-method-page" :style="pageStyle">
    <AppNavBar title="选择登录方式" :show-back="false" :with-safe-top="false" />
    <view class="hero">
      <text class="hero-emoji">🂡</text>
      <text class="hero-title">同步你的 24 点战绩</text>
      <text class="hero-sub">支持微信账号与本机普通账号</text>
    </view>

    <view class="card">
      <!-- 微信登录，仅小程序可见 -->
      <!-- #ifdef MP-WEIXIN -->
      <button class="action weixin" :loading="loading === 'wx'" @tap="handleWxLogin">
        <text>使用微信账号登录</text>
      </button>
      <!-- #endif -->

      <button class="action local" @tap="goLocalList">
        <text>使用本机普通账号</text>
      </button>
    </view>

    <view class="tips">
      <text>普通账号可离线使用，数据与当前设备绑定，可在“我的-升级”转为微信账号。</text>
    </view>

    <view v-if="errMsg" class="err">{{ errMsg }}</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppNavBar from '../../components/AppNavBar.vue'
import { loginWithWeixin } from '../../utils/auth.js'
import { useSafeArea } from '../../utils/useSafeArea.js'

const loading = ref('')
const errMsg = ref('')
const { safeTop } = useSafeArea()
const pageStyle = computed(() => ({ paddingTop: `${Math.max(0, safeTop.value || 0)}px` }))

async function handleWxLogin() {
  if (loading.value) return
  loading.value = 'wx'
  errMsg.value = ''
  try {
    const session = await loginWithWeixin('mp-weixin')
    if (session?.user) {
      uni.showToast({ title: '登录成功', icon: 'success' })
      goHome()
    }
  } catch (err) {
    console.error(err)
    errMsg.value = err?.message || '微信登录失败'
  } finally {
    loading.value = ''
  }
}

function goLocalList() {
  uni.navigateTo({ url: '/pages/local-account/list' })
}

function goHome() {
  try {
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (err) {
    uni.switchTab({ url: '/pages/index/index' })
  }
}
</script>

<style scoped>
.login-method-page {
  min-height: 100vh;
  padding: 32rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  box-sizing: border-box;
}
.hero {
  margin-top: 40rpx;
  text-align: center;
  color: #0f172a;
}
.hero-emoji {
  font-size: 96rpx;
}
.hero-title {
  margin-top: 16rpx;
  font-size: 42rpx;
  font-weight: 600;
  display: block;
}
.hero-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 28rpx;
  color: #475569;
}
.card {
  margin-top: 48rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.08);
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.action {
  height: 96rpx;
  border-radius: 18rpx;
  border: none;
  font-size: 32rpx;
  color: #0f172a;
}
.action.weixin {
  background: #06c160;
  color: #fff;
}
.action.local {
  background: #e0f2fe;
  color: #0369a1;
}
.tips {
  margin-top: 32rpx;
  font-size: 26rpx;
  color: #475569;
  line-height: 1.5;
}
.err {
  margin-top: 20rpx;
  color: #dc2626;
  font-size: 26rpx;
}
</style>
