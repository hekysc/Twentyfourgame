<template>
  <view class="ctb" :style="wrapStyle">
    <button
      v-for="item in tabs"
      :key="item.key"
      class="ctb-item"
      :class="{ active: isActive(item.key) }"
      @click="go(item.url)"
    >
      <view class="ctb-icon" :class="['icon-' + item.key, { active: isActive(item.key) }]">
        <text>{{ item.icon }}</text>
      </view>
      <text class="label" :class="{ active: isActive(item.key) }">{{ item.label }}</text>
    </button>
  </view>
  <view class="ctb-safe" />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const currentPath = ref('')
const wrapStyle = ref('')
const tabs = [
  { key: 'stats', label: '统计', icon: '📈', url: '/pages/stats/index' },
  { key: 'index', label: '程序', icon: '🃏', url: '/pages/index/index' },
  { key: 'user', label: '玩家', icon: '🎯', url: '/pages/user/index' },
]

onMounted(() => {
  try {
    uni.hideTabBar && uni.hideTabBar()
  } catch (_) {}
  updatePath()
  try {
    const sys = uni.getSystemInfoSync && uni.getSystemInfoSync()
    const hb = (sys && sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
    wrapStyle.value = `padding-bottom:${hb ? hb + 'px' : 'env(safe-area-inset-bottom)'}`
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 36rpx;
  background: rgba(18, 32, 71, 0.58);
  box-shadow: 0 24rpx 64rpx rgba(12, 20, 48, 0.36);
  border: 2rpx solid rgba(255, 255, 255, 0.18);
  backdrop-filter: saturate(180%) blur(22px);
}
.ctb-safe {
  height: calc(env(safe-area-inset-bottom) + 32rpx);
}
.ctb-item {
  background: rgba(255, 255, 255, 0.08);
  border: 2rpx solid rgba(255, 255, 255, 0.16);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 0;
  border-radius: 26rpx;
  transition: transform 0.22s ease, box-shadow 0.24s ease, background 0.22s ease;
  color: var(--text-invert);
  box-shadow: none;
}
.ctb-item:active {
  transform: translateY(4rpx) scale(0.96);
}
.ctb-item.active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.32);
  box-shadow: var(--glow-primary);
}
.ctb-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.18);
  transition: transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease;
}
.ctb-icon.active {
  transform: scale(1.08);
  box-shadow: 0 18rpx 36rpx rgba(255, 255, 255, 0.18);
}
.ctb-icon.icon-stats { background: linear-gradient(135deg, rgba(111, 107, 255, 0.85), rgba(103, 232, 249, 0.9)); }
.ctb-icon.icon-index { background: linear-gradient(135deg, rgba(255, 138, 167, 0.88), rgba(255, 176, 126, 0.88)); }
.ctb-icon.icon-user { background: linear-gradient(135deg, rgba(124, 121, 255, 0.9), rgba(186, 201, 255, 0.85)); }
.label {
  font-size: 26rpx;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.68);
  transition: color 0.18s ease, transform 0.18s ease;
  letter-spacing: 1rpx;
}
.label.active {
  color: #ffffff;
  transform: translateY(-2rpx);
}
</style>
