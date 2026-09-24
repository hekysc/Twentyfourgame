<template>
  <view class="settings-page">
    <AppNavBar title="设置" :show-back="true" :back-to-index="true" />
    <view v-if="onlineMode" class="settings-sync-row"><CloudSyncStatus :online="onlineMode" /></view>
    <view class="settings-body" :style="bodyStyle">
      <view class="settings-intro">
        <text class="settings-kicker">GAME SETTINGS</text>
        <text class="settings-heading">自定义你的挑战</text>
        <text class="settings-copy">规则、题库和偏好会在下一局即时生效。</text>
      </view>
      <view class="section">
        <view class="section-head"><text class="section-icon">♠</text><view><view class="section-title">默认模式</view><text class="section-desc">选择更适合你的解题方式</text></view></view>
        <radio-group class="radio-group" @change="onModeChange" :value="playMode">
          <label class="radio-item" v-for="item in modeOptions" :key="item.value">
            <radio :value="item.value" :checked="playMode === item.value" />
            <text class="radio-label">{{ item.label }}</text>
          </label>
        </radio-group>
        <view class="section-tip">切换后返回题目页时会自动应用</view>
      </view>
      <view class="section">
        <view class="section-head"><text class="section-icon">A</text><view><view class="section-title">JQK 数值</view><text class="section-desc">决定面牌在算式中的取值</text></view></view>
        <radio-group class="radio-group" @change="onRankModeChange" :value="rankMode">
          <label class="radio-item" v-for="item in rankOptions" :key="item.value">
            <radio :value="item.value" :checked="rankMode === item.value" />
            <text class="radio-label">{{ item.label }}</text>
          </label>
        </radio-group>
        <view class="section-tip">仅可选择两套固定规则。</view>
      </view>

      <view class="section">
        <view class="section-head"><text class="section-icon">▤</text><view><view class="section-title">题库来源</view><text class="section-desc">针对性训练或随机挑战</text></view></view>
        <radio-group class="radio-group" @change="onDeckSourceChange" :value="deckSource">
          <label class="radio-item" v-for="item in deckOptions" :key="item.value">
            <radio :value="item.value" :checked="deckSource === item.value" />
            <text class="radio-label">{{ item.label }}</text>
          </label>
        </radio-group>
        <view v-if="deckSource === 'mix'" class="mix-weight">
          <view class="mix-label">错题权重 {{ mixWeight }}%</view>
          <slider
            :value="mixWeight"
            min="0"
            max="100"
            step="1"
            @change="onMixWeightChange"
            active-color="#24715C"
            background-color="#e2e8f0"
          />
        </view>
      </view>

      <!-- 隐藏其他偏好设置板块 -->
      <view class="section" v-if="false">
        <view class="section-title">其他偏好</view>
        <view class="toggle-item" v-for="toggle in toggles" :key="toggle.key">
          <view class="toggle-texts">
            <text class="toggle-title">{{ toggle.title }}</text>
            <text class="toggle-desc">{{ toggle.desc }}</text>
          </view>
          <switch
            :checked="toggle.checked"
            @change="(e) => onToggleChange(toggle.key, e.detail.value)"
            color="#24715C"
          />
        </view>
      </view>

      <view class="section">
        <view class="cache-copy"><text>局内缓存</text><text>清除临时牌局，不会影响用户与战绩。</text></view>
        <button class="clear-cache" @tap="clearCache">清理局内缓存</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { flushPrefs } from '../../utils/online.js'
import { onHide, onBackPress, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import CloudSyncStatus from '../../components/CloudSyncStatus.vue'
import { isOnline } from '../../utils/identity.js'
import { useSafeArea } from '../../utils/useSafeArea.js'
import { getGameplayPrefs, setGameplayPrefs, consumeRankMigrationNotice, getLastMode, setLastMode } from '../../utils/prefs.js'
import { navigateToHome } from '../../utils/navigation.js'

const { safeBottom } = useSafeArea()
const onlineMode = ref(isOnline())
const MODE_CHANGE_EVENT = 'tf24:mode-changed'

const playMode = ref(getLastMode ? getLastMode() : 'basic')
const rankMode = ref('jqk-1')
const deckSource = ref('regular')
const mixWeight = ref(50)
const haptics = ref(true)
const sfx = ref(true)
const reducedMotion = ref(false)

const modeOptions = [
  { value: 'basic', label: '基础模式（点选）' },
  { value: 'pro', label: '专业模式（拖拽）' },
]

const rankOptions = [
  { value: 'jqk-1', label: 'JQK 记作 1' },
  { value: 'jqk-11-12-13', label: 'JQK 记作 11/12/13' },
]

const deckOptions = [
  { value: 'regular', label: '常规题库' },
  { value: 'mistakes', label: '错题本' },
  { value: 'mix', label: '混合' },
]

const bodyStyle = computed(() => ({
  paddingBottom: `${Math.max(24, (safeBottom.value || 0) + 24)}px`,
}))

const toggles = computed(() => ([
  {
    key: 'haptics',
    title: '振动反馈',
    desc: '答题提示或失败时震动提醒',
    checked: haptics.value,
  },
  {
    key: 'sfx',
    title: '音效提示',
    desc: '保留关键操作音效',
    checked: sfx.value,
  },
  {
    key: 'reducedMotion',
    title: '低性能模式',
    desc: '减少动画效果以提升流畅度',
    checked: reducedMotion.value,
  },
]))

onHide(() => { flushPrefs().catch(()=>{}) })

onBackPress(() => {
  navigateToHome()
  return true
})

// 添加防重复标志和缓存
let hasLoaded = false
let isSyncing = false
let lastSyncTime = 0

function syncFromStorage(showMigration = false) {
  // 防止短时间内重复调用
  const now = Date.now()
  if (isSyncing || (now - lastSyncTime) < 100) {
    return
  }
  
  isSyncing = true
  lastSyncTime = now
  
  try {
    const prefs = getGameplayPrefs()
    playMode.value = getLastMode ? getLastMode() : playMode.value
    rankMode.value = prefs.rankMode
    deckSource.value = prefs.deckSource
    mixWeight.value = prefs.mixWeight
    haptics.value = !!prefs.haptics
    sfx.value = !!prefs.sfx
    reducedMotion.value = !!prefs.reducedMotion
    if (showMigration && prefs.rankMigrationNotice) {
      try {
        uni.showToast({
          title: '已迁移到新规则：JQK 仅支持 1 或 11/12/13',
          icon: 'none',
          duration: 2500,
        })
      } catch (_) {}
      consumeRankMigrationNotice()
    }
  } finally {
    isSyncing = false
  }
}

// 修改页面生命周期钩子，避免重复加载
onMounted(() => {
  // 只在首次挂载时同步数据
  if (!hasLoaded) {
    hasLoaded = true
    syncFromStorage(true)
  }
})

onShow(() => {
  // onShow中不再调用syncFromStorage，避免重复加载
  // 如果需要数据同步，可以考虑只在特定情况下执行
})

onUnmounted(() => {
  // 页面卸载时重置标志，确保下次进入页面时能正常加载
  hasLoaded = false
  isSyncing = false
})

function onModeChange(e) {
  const raw = e?.detail?.value ?? e?.target?.value ?? ''
  const normalized = raw === 'pro' ? 'pro' : 'basic'
  if (playMode.value !== normalized) {
    playMode.value = normalized
  }
  try { setLastMode(normalized) } catch (_) {}
  try {
    if (typeof uni.$emit === 'function') {
      uni.$emit(MODE_CHANGE_EVENT, normalized)
    }
  } catch (_) {}
}

function onRankModeChange(e) {
  const value = e?.detail?.value || 'jqk-1'
  console.log('onRankModeChange called with:', value)
  rankMode.value = value
  setGameplayPrefs({ rankMode: value })
  
  // 立即通知其他页面设置已更改
  try {
    if (typeof uni.$emit === 'function') {
      console.log('Emitting tf24:rank-mode-changed event with value:', value)
      uni.$emit('tf24:rank-mode-changed', value)
      // 使用全局事件确保通知能够跨页面传播
      try {
        uni.$emit('tf24:gameplay-prefs-changed', { rankMode: value })
        console.log('Emitting tf24:gameplay-prefs-changed event')
      } catch (_) {}
    }
  } catch (err) {
    console.error('Error emitting rank mode change event:', err)
  }
  
}

function onDeckSourceChange(e) {
  const value = e?.detail?.value || 'regular'
  deckSource.value = value
  setGameplayPrefs({ deckSource: value })
}

function onMixWeightChange(e) {
  const value = Number(e?.detail?.value)
  if (!Number.isFinite(value)) return
  mixWeight.value = Math.min(100, Math.max(0, Math.round(value)))
  setGameplayPrefs({ mixWeight: mixWeight.value })
}

function onToggleChange(key, value) {
  if (key === 'haptics') haptics.value = !!value
  if (key === 'sfx') sfx.value = !!value
  if (key === 'reducedMotion') reducedMotion.value = !!value
  setGameplayPrefs({
    haptics: haptics.value,
    sfx: sfx.value,
    reducedMotion: reducedMotion.value,
  })
}

function clearCache() {
  try {
    uni.showModal({
      title: '清理缓存',
      content: '将清除当前牌局缓存，保留用户与统计数据。',
      confirmText: '立即清理',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try { uni.removeStorageSync('tf24_game_session_v1') } catch (_) {}
          try { uni.removeStorageSync('__tf24_tab_cache__') } catch (_) {}
          try {
            uni.showToast({ title: '缓存已清理', icon: 'success' })
          } catch (_) {}
        }
      },
    })
  } catch (_) {
    try { uni.removeStorageSync('tf24_game_session_v1') } catch (err) {}
    try { uni.removeStorageSync('__tf24_tab_cache__') } catch (err) {}
  }
}

// 分享给好友
onShareAppMessage(() => {
  return {
    title: '24点游戏小程序 - 挑战你的计算能力！',
    path: '/pages/index/index',
    imageUrl: '' // 使用系统默认截图或小程序logo
  }
})

// 分享到朋友圈
onShareTimeline(() => {
  return {
    title: '24点游戏小程序 - 挑战你的计算能力！',
    query: '',
    imageUrl: '' // 使用系统默认截图或小程序logo
  }
})

</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--tf24-paper);
}

.settings-body {
  padding: 16rpx 32rpx 48rpx;
  margin-top: 16rpx;
  box-sizing: border-box;
}
.settings-intro{ padding:20rpx 6rpx 28rpx; display:flex; flex-direction:column; gap:8rpx }
.settings-kicker{ color:#aa8d47; font-size:20rpx; font-weight:800; letter-spacing:4rpx }
.settings-heading{ color:var(--tf24-ink); font-size:42rpx; font-weight:800 }
.settings-copy{ color:var(--tf24-muted); font-size:24rpx; line-height:1.5 }

.section {
  background: var(--tf24-surface);
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.08);
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--tf24-ink);
  margin-bottom: 24rpx;
}
.section-head{ display:flex; align-items:center; gap:16rpx; margin-bottom:24rpx }
.section-head .section-title{ margin:0 }
.section-icon{ width:52rpx; height:52rpx; border-radius:16rpx; display:flex; align-items:center; justify-content:center; background:#f1e8cd; color:#8a702f; font-family:Georgia,serif; font-size:28rpx; font-weight:800 }
.section-desc{ display:block; margin-top:4rpx; color:var(--tf24-muted); font-size:22rpx }

.section-tip {
  font-size: 24rpx;
  color: #64748b;
  margin-top: 16rpx;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 28rpx;
  color: #1f2937;
}

.mix-weight {
  margin-top: 24rpx;
}

.mix-label {
  font-size: 26rpx;
  color: var(--tf24-ink);
  margin-bottom: 12rpx;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.toggle-item:last-child {
  margin-bottom: 0;
}

.toggle-texts {
  flex: 1;
  margin-right: 16rpx;
}

.toggle-title {
  font-size: 28rpx;
  color: var(--tf24-ink);
  font-weight: 500;
}

.toggle-desc {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.clear-cache {
  width: 100%;
  padding: 20rpx 0;
  background: var(--tf24-danger);
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 9999rpx;
}
.cache-copy{ display:flex; flex-direction:column; gap:6rpx; margin-bottom:20rpx; color:var(--tf24-ink); font-size:26rpx; font-weight:800 }
.cache-copy text:last-child{ color:var(--tf24-muted); font-size:22rpx; font-weight:500 }
.settings-sync-row {
  display: flex;
  justify-content: flex-end;
  min-height: 34rpx;
  padding: 8rpx 40rpx 0;
}
</style>
