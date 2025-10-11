<template>
  <view class="settings-page">
    <AppNavBar title="设置" :show-back="true" :back-to-index="true" />
    <view class="settings-body" :style="bodyStyle">
      <view class="section">
        <view class="section-title">默认模式</view>
        <radio-group class="radio-group" @change="onModeChange" :value="playMode">
          <label class="radio-item" v-for="item in modeOptions" :key="item.value">
            <radio :value="item.value" :checked="playMode === item.value" />
            <text class="radio-label">{{ item.label }}</text>
          </label>
        </radio-group>
        <view class="section-tip">切换后返回题目页时会自动应用</view>
      </view>
      <view class="section">
        <view class="section-title">JQK 数值</view>
        <radio-group class="radio-group" @change="onRankModeChange" :value="rankMode">
          <label class="radio-item" v-for="item in rankOptions" :key="item.value">
            <radio :value="item.value" :checked="rankMode === item.value" />
            <text class="radio-label">{{ item.label }}</text>
          </label>
        </radio-group>
        <view class="section-tip">仅可选择两套固定规则。</view>
      </view>

      <view class="section">
        <view class="section-title">题库来源</view>
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
            active-color="#2563eb"
            background-color="#e2e8f0"
          />
        </view>
      </view>

      <view class="section">
        <view class="section-title">其他偏好</view>
        <view class="toggle-item" v-for="toggle in toggles" :key="toggle.key">
          <view class="toggle-texts">
            <text class="toggle-title">{{ toggle.title }}</text>
            <text class="toggle-desc">{{ toggle.desc }}</text>
          </view>
          <switch
            :checked="toggle.checked"
            @change="(e) => onToggleChange(toggle.key, e.detail.value)"
            color="#2563eb"
          />
        </view>
      </view>

      <view class="section">
        <button class="clear-cache" @tap="clearCache">清理缓存</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { onBackPress, onShow } from '@dcloudio/uni-app'
import AppNavBar from '../../components/AppNavBar.vue'
import { useSafeArea } from '../../utils/useSafeArea.js'
import { getGameplayPrefs, setGameplayPrefs, consumeRankMigrationNotice, getLastMode, setLastMode } from '../../utils/prefs.js'
import { navigateToHome } from '../../utils/navigation.js'

const { safeBottom } = useSafeArea()
const MODE_CHANGE_EVENT = 'tf24:mode-changed'

const playMode = ref(getLastMode ? getLastMode() : 'basic')
const rankMode = ref('jqk-11-12-13')
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

onBackPress(() => {
  navigateToHome()
  return true
})

function syncFromStorage(showMigration = false) {
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
}

onMounted(() => {
  syncFromStorage(true)
})

onShow(() => {
  syncFromStorage(false)
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
  try {
    uni.showToast({
      title: normalized === 'pro' ? '已切换为专业模式' : '已切换为基础模式',
      icon: 'none',
      duration: 1600,
    })
  } catch (_) {}
}

function onRankModeChange(e) {
  const value = e?.detail?.value || 'jqk-11-12-13'
  rankMode.value = value
  setGameplayPrefs({ rankMode: value })
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

</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #f3f4f6;
}

.settings-body {
  padding: 16rpx 32rpx 48rpx;
  margin-top: 16rpx;
  box-sizing: border-box;
}

.section {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.08);
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 24rpx;
}

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
  color: #0f172a;
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
  color: #111827;
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
  background: linear-gradient(135deg, #ef4444, #f87171);
  color: #ffffff;
  font-size: 28rpx;
  border-radius: 9999rpx;
}
</style>
