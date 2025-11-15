<template>
  <view class="ad-demo">
    <view class="user-card">
      <image class="avatar" :src="userAvatar" mode="aspectFill" />
      <view class="info">
        <text class="name">{{ userName }}</text>
        <text class="desc">云端 UID：{{ user?._id || '未登录' }}</text>
        <button class="sync-btn" size="mini" @click="syncProfile" v-if="canSyncProfile">同步微信头像</button>
      </view>
    </view>

    <view class="records" v-if="records.length">
      <view class="records__title">最近战绩（云端）</view>
      <view class="record" v-for="item in records" :key="item._id">
        <text>{{ formatRecordTime(item.created_at) }}</text>
        <text>{{ item.success ? '通关 ✅' : '未完成 ❌' }}</text>
      </view>
    </view>
    <view class="records empty" v-else>
      <text>暂无云端战绩，完成一局后调用 game.saveRecord 即可同步。</text>
    </view>

    <button class="refresh-btn" type="primary" @click="loadRecords">刷新云战绩</button>

    <view class="reward-panel">
      <view class="reward-panel__title">激励视频示例</view>
      <button class="reward-btn" type="warn" :loading="rewarding" @click="watchAd">
        看广告获取提示/复活
      </button>
      <text class="reward-status">{{ rewardStatus }}</text>
    </view>

    <view class="banner-slot" v-if="bannerUnitId">
      <text class="banner-label">Banner 广告示例</text>
      <!-- #ifdef MP-WEIXIN -->
      <ad v-if="bannerUnitId" :unit-id="bannerUnitId" ad-intervals="30"></ad>
      <!-- #endif -->
      <!-- #ifdef APP-PLUS -->
      <ad v-if="bannerUnitId" :unit-id="bannerUnitId" ad-type="banner" ad-theme="white"></ad>
      <!-- #endif -->
      <view class="banner-placeholder" v-if="!supportsAd">
        当前平台暂不支持 uni-ad，将自动回退为提示信息。
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ensureAutoLogin, getSession, getWxProfileAndUpdate } from '../../utils/auth.js'
import { showRewardedAd, showBannerAd, getBannerUnitId } from '../../utils/ad.js'

const records = ref([])
const rewardStatus = ref('尚未观看广告')
const rewarding = ref(false)
const bannerUnitId = getBannerUnitId()
const supportsAd = !!(
  bannerUnitId &&
  (typeof uni.createBannerAd === 'function' || (typeof wx !== 'undefined' && typeof wx.createBannerAd === 'function'))
)
const userState = ref(getSession())
const bannerInstance = ref(null)

const user = computed(() => userState.value.user)
const userAvatar = computed(() => user.value?.avatar_url || 'https://qiniu-web-assets.dcloud.net.cn/unidoc/zh/unicloudlogo.png')
const userName = computed(() => user.value?.nickname || '游客玩家')
const canSyncProfile = computed(() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
})

async function ensureLoginThen(callback) {
  const session = getSession()
  if (!session.token) {
    const res = await ensureAutoLogin()
    if (res) {
      userState.value = res
    }
  } else {
    userState.value = session
  }
  if (typeof callback === 'function') {
    return callback()
  }
}

async function loadRecords() {
  await ensureLoginThen()
  const { token } = getSession()
  if (!token) return
  const { result } = await uniCloud.callFunction({
    name: 'game',
    data: {
      action: 'listRecords',
      token,
      data: { limit: 10 }
    }
  })
  if (result?.list) {
    records.value = result.list
  }
}

async function syncProfile() {
  try {
    await getWxProfileAndUpdate()
    userState.value = getSession()
  } catch (err) {
    uni.showToast({ title: err.message || '同步失败', icon: 'none' })
  }
}

async function watchAd() {
  rewarding.value = true
  rewardStatus.value = '广告加载中...'
  const res = await showRewardedAd({
    onReward() {
      rewardStatus.value = '奖励已发放，提示+1'
    }
  })
  rewarding.value = false
  if (!res.success) {
    rewardStatus.value = '未能完成广告或平台不支持'
  } else if (res.success && rewardStatus.value.indexOf('奖励已发放') === -1) {
    rewardStatus.value = '观看完成'
  }
}

function formatRecordTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const min = `${date.getMinutes()}`.padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

onMounted(() => {
  ensureLoginThen(loadRecords)
  bannerInstance.value = showBannerAd({ width: 320 })
})

onUnmounted(() => {
  bannerInstance.value?.destroy?.()
})
</script>

<style scoped lang="scss">
.ad-demo {
  padding: 32rpx;
  color: #333;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.user-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.08);
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 24rpx;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.name {
  font-weight: 600;
  font-size: 34rpx;
}

.desc {
  font-size: 26rpx;
  color: #666;
}

.sync-btn {
  align-self: flex-start;
}

.records {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, 0.05);
}

.records__title {
  font-size: 28rpx;
  margin-bottom: 12rpx;
}

.record {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1px solid #f2f2f2;
}

.record:last-child {
  border-bottom: none;
}

.reward-panel {
  background: #fff7f0;
  border-radius: 24rpx;
  padding: 24rpx;
}

.reward-panel__title {
  font-size: 30rpx;
  margin-bottom: 16rpx;
}

.reward-btn {
  margin-top: 12rpx;
}

.reward-status {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #666;
}

.banner-slot {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
}

.banner-label {
  font-size: 28rpx;
  margin-bottom: 12rpx;
  display: block;
}

.banner-placeholder {
  color: #888;
  font-size: 26rpx;
}

.refresh-btn {
  width: 100%;
}
</style>
