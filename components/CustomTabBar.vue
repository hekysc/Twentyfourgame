<template>
  <view class="ctb" :style="wrapStyle">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      class="ctb-item"
      :class="{ active: isActive(tab.key) }"
      @click="go(tab.url)"
    >
      <view class="ctb-item-body">
        <view class="icon-shell" :class="{ active: isActive(tab.key) }">
          <image class="icon-img" mode="aspectFit" :src="tab.icon" />
          <view v-if="tab.badge" class="badge">{{ tab.badge }}</view>
          <view v-else-if="tab.dot" class="status-dot" />
        </view>
        <text class="label" :class="{ active: isActive(tab.key) }">{{ tab.label }}</text>
      </view>
    </button>
  </view>
  <view class="ctb-safe"/>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const tabs = [
  { key: 'stats', label: '统计', url: '/pages/stats/index', icon: '/static/icons/tab-stats.svg' },
  { key: 'index', label: '程序', url: '/pages/index/index', icon: '/static/icons/tab-game.svg' },
  { key: 'user', label: '用户', url: '/pages/user/index', icon: '/static/icons/tab-user.svg' }
]

const currentPath = ref('')
const wrapStyle = ref('')
const SAFE_EXTRA_PX = 20

onMounted(() => {
  try {
    uni.hideTabBar && uni.hideTabBar()
  } catch (_) {}
  updatePath()
  try {
    const sys = uni.getSystemInfoSync && uni.getSystemInfoSync()
    const hb = (sys && sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
    wrapStyle.value = hb
      ? `padding-bottom:${hb + SAFE_EXTRA_PX}px`
      : `padding-bottom:calc(env(safe-area-inset-bottom) + ${SAFE_EXTRA_PX}px)`
  } catch (_) {}
  // 监听全局路由同步事件，确保返回/手势返回后高亮状态更新
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
  // 去掉查询/哈希，并统一重复斜杠
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
  // 点击当前已激活 Tab：直接返回，不做任何处理，避免刷新
  const now = currentRoutePath()
  const target = normalizePath(url)
  if (now && target && now === target) return

  const done = () => { try { updatePath() } catch(_) {} }

  // 导航顺序：switchTab -> navigateTo -> reLaunch（兜底）
  if (uni && typeof uni.switchTab === 'function') {
    uni.switchTab({ url,
      success: done,
      fail() {
        if (typeof uni.navigateTo === 'function') {
          uni.navigateTo({ url,
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
    uni.navigateTo({ url,
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
.ctb {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: 24rpx;
  z-index: 999;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 22rpx 26rpx;
  border-radius: 40rpx;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.72) 0%, rgba(30, 41, 59, 0.55) 100%);
  box-shadow: 0 26rpx 60rpx rgba(15, 23, 42, 0.32);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(30rpx);
  -webkit-backdrop-filter: blur(30rpx);
  overflow: visible;
  isolation: isolate;
  transition: box-shadow 0.35s ease, background 0.35s ease;
}
.ctb::after {
  content: '';
  position: absolute;
  inset: 1rpx;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(148, 163, 184, 0.08));
  opacity: 0.22;
  z-index: 0;
}
.ctb-safe {
  height: calc(env(safe-area-inset-bottom) + 180rpx);
}
.ctb-item {
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 6rpx;
  border-radius: 26rpx;
  transition: transform 0.24s cubic-bezier(0.22, 0.61, 0.36, 1), box-shadow 0.24s ease, background 0.24s ease;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.05);
  overflow: visible;
  z-index: 1;
}
.ctb-item-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.ctb-item:active {
  transform: translateY(4rpx) scale(0.96);
  box-shadow: inset 0 0 0 1rpx rgba(148, 163, 184, 0.14);
}
.ctb-item.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.24), rgba(96, 165, 250, 0.14));
  box-shadow: 0 18rpx 38rpx rgba(59, 130, 246, 0.3), 0 0 0 1rpx rgba(148, 163, 184, 0.25) inset;
}
.ctb-item.active:active {
  transform: translateY(2rpx) scale(0.98);
}
.icon-shell {
  position: relative;
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.15);
  transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}
.icon-shell.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.78), rgba(96, 165, 250, 0.64));
  box-shadow: 0 12rpx 26rpx rgba(37, 99, 235, 0.45), inset 0 0 0 1rpx rgba(255, 255, 255, 0.35);
  transform: translateY(-4rpx) scale(1.06);
}
.icon-img {
  width: 44rpx;
  height: 44rpx;
}
.badge {
  position: absolute;
  top: -6rpx;
  right: -4rpx;
  min-width: 32rpx;
  padding: 2rpx 8rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #f97316, #fbbf24);
  color: #0f172a;
  font-size: 20rpx;
  font-weight: 800;
  box-shadow: 0 10rpx 20rpx rgba(249, 115, 22, 0.35);
}
.status-dot {
  position: absolute;
  top: -2rpx;
  right: 2rpx;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #34d399, #10b981);
  box-shadow: 0 8rpx 14rpx rgba(16, 185, 129, 0.45);
}
.label {
  font-size: 26rpx;
  font-weight: 700;
  color: rgba(226, 232, 240, 0.78);
  letter-spacing: 2rpx;
  transition: transform 0.24s ease, color 0.24s ease;
}
.label.active {
  color: #f8fafc;
  text-shadow: 0 4rpx 18rpx rgba(59, 130, 246, 0.75);
  transform: translateY(-2rpx) scale(1.08);
}
</style>
