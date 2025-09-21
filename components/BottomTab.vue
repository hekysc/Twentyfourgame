<template>
  <view class="bottom-tab" :style="wrapStyle">
    <view class="claymorphism row" style="justify-content:space-around; align-items:center; padding:16rpx; gap:16rpx;">
      <view class="tab-item" :class="{ active: isActive('stats') }" @tap="go('/pages/stats/index')">
        <text class="tab-icon">📊</text>
        <text class="tab-text">统计</text>
      </view>
      <view class="tab-item" :class="{ active: isActive('index') }" @tap="go('/pages/index/index')">
        <text class="tab-icon">🎮</text>
        <text class="tab-text">程序</text>
      </view>
      <view class="tab-item" :class="{ active: isActive('user') }" @tap="go('/pages/user/index')">
        <text class="tab-icon">👤</text>
        <text class="tab-text">用户</text>
      </view>
    </view>
    <view class="tab-safe" />
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const currentPath = ref('')
const wrapStyle = ref('')

onMounted(() => {
  try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}
  updatePath()
  try {
    const sys = uni.getSystemInfoSync && uni.getSystemInfoSync()
    const hb = (sys && sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
    wrapStyle.value = `padding-bottom:${hb ? hb + 'px' : 'env(safe-area-inset-bottom)'}`
  } catch (_) {}
  try { uni.$off && uni.$off('tabbar:update', updatePath) } catch(_) {}
  try { uni.$on && uni.$on('tabbar:update', updatePath) } catch(_) {}
})

onUnmounted(() => { try { uni.$off && uni.$off('tabbar:update', updatePath) } catch(_) {} })

function updatePath(){
  try {
    const pages = getCurrentPages && getCurrentPages()
    const cur = pages && pages[pages.length - 1]
    currentPath.value = (cur && (cur.route || cur.$page?.fullPath || '')) || ''
  } catch (_) { currentPath.value = '' }
}

function isActive(key){
  const p = currentPath.value
  if (!p) return false
  if (key === 'stats') return p.includes('pages/stats/index')
  if (key === 'index') return p.includes('pages/index/index')
  if (key === 'user') return p.includes('pages/user/index')
  return false
}

function normalizePath(u){
  if (!u) return ''
  const s = String(u)
  const withSlash = s.startsWith('/') ? s : ('/' + s)
  return withSlash.split(/[?#]/)[0].replace(/\/+/g, '/')
}

function currentRoutePath(){
  try {
    const pages = getCurrentPages && getCurrentPages()
    const cur = pages && pages[pages.length - 1]
    const r = (cur && (cur.route || cur.$page?.fullPath || '')) || ''
    return normalizePath(r)
  } catch(_) { return '' }
}

function go(url){
  const now = currentRoutePath()
  const target = normalizePath(url)
  if (now && target && now === target) return

  const done = () => { try { updatePath() } catch(_) {} }

  if (uni && typeof uni.switchTab === 'function') {
    uni.switchTab({
      url,
      success: done,
      fail() {
        if (typeof uni.navigateTo === 'function') {
          uni.navigateTo({
            url,
            success: done,
            fail() {
              if (typeof uni.reLaunch === 'function') {
                uni.reLaunch({ url, success: done, fail: done })
              } else { done() }
            }
          })
        } else if (typeof uni.reLaunch === 'function') {
          uni.reLaunch({ url, success: done, fail: done })
        } else { done() }
      }
    })
    return
  }

  if (typeof uni.navigateTo === 'function') {
    uni.navigateTo({
      url,
      success: done,
      fail() {
        if (typeof uni.reLaunch === 'function') {
          uni.reLaunch({ url, success: done, fail: done })
        } else { done() }
      }
    })
  } else if (typeof uni.reLaunch === 'function') {
    uni.reLaunch({ url, success: done, fail: done })
  }
}
</script>

<style scoped>
.bottom-tab {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.tab-safe { height: env(safe-area-inset-bottom); }

.tab-item {
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:8rpx;
  padding:12rpx 24rpx;
  border-radius:24rpx;
  transition: all .2s ease-in-out;
  color: var(--text-dark);
}

.tab-item.active {
  background: var(--primary);
  color: #fff;
  box-shadow: 6rpx 6rpx 12rpx var(--primary-dark), -6rpx -6rpx 12rpx #c4eaff;
}

.tab-item:active {
  box-shadow: inset 4rpx 4rpx 8rpx var(--bg-dark), inset -4rpx -4rpx 8rpx #ffffff;
}

.tab-icon { font-size: 36rpx; }
.tab-text { font-size: 24rpx; font-weight: 700; }
</style>
