<template>
  <view class="entry"
    ><AppNavBar title="24 点" :show-back="false" />
    <view class="entry-body">
      <text class="eyebrow">TWENTY FOUR</text
      ><text class="hero">四张纸牌，
无限可能。</text>
      <text class="intro">用加减乘除，让答案成为 24。</text>
      <view class="mode-card"
        ><text class="card-title">微信在线挑战</text
        ><text class="copy"
          >云端保存战绩、错题和设置，换设备继续。
参与成功率与最快时间排名，榜单匿名展示。</text
        >
        <button class="primary" :loading="busy" :disabled="busy" @tap="login">
          微信登录
        </button>
      </view>
      <view class="mode-card practice"
        ><text class="card-title">本地练习</text
        ><text class="copy">无需帐号，无需联网。练习记录只留在本机。</text
        ><button :disabled="busy" @tap="practice">开始练习</button></view
      >
      <text v-if="error" class="error">{{ error }}</text>
      <text class="foot"
        >原本地帐号记录已合并保留在练习模式中。
在线成绩从登录后开始累计。</text
      >
    </view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import AppNavBar from '../../components/AppNavBar.vue'
import { ensureInit } from '../../utils/store.js'
import { loginOnline, enterPractice } from '../../utils/online.js'
ensureInit()
const busy = ref(false),
  error = ref('')
function practice() {
  enterPractice()
  uni.reLaunch({ url: '/pages/index/index' })
}
async function login() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await loginOnline()
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (e) {
    error.value = e.message || '登录失败，请重试'
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
</style>
