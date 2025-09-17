<template>
  <view class="ctb" :style="wrapStyle">
    <button class="ctb-item" :class="{ active: isActive('stats') }" @click="go('/pages/stats/index')">
      <text class="icon" :class="{ active: isActive('stats') }">📊</text>
      <text class="label" :class="{ active: isActive('stats') }">统计</text>
    </button>
    <button class="ctb-item" :class="{ active: isActive('index') }" @click="go('/pages/index/index')">
      <text class="icon" :class="{ active: isActive('index') }">🎮</text>
      <text class="label" :class="{ active: isActive('index') }">程序</text>
    </button>
    <button class="ctb-item" :class="{ active: isActive('user') }" @click="go('/pages/user/index')">
      <text class="icon" :class="{ active: isActive('user') }">👤</text>
      <text class="label" :class="{ active: isActive('user') }">用户</text>
    </button>
  </view>
  <view class="ctb-safe"/>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const currentPath = ref('')
const wrapStyle = ref('')

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
})

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
  left: 0; 
  right: 0; 
  bottom: 0; 
  z-index: 999; 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
  background: #ffffff; 
  box-shadow: 0 -6rpx 16rpx rgba(15,23,42,.06); 
  padding: 10rpx 8rpx; 
  transition: background-color 0.3s ease;
}
.ctb-safe { height: env(safe-area-inset-bottom); }
.ctb-item { 
  background: transparent; 
  border: none; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  width: 25dvw;
  padding: 10rpx 0; 
  gap: 6rpx; 
  transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  border-radius: 12rpx;
  overflow: visible;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  box-shadow: none;
}
.ctb-item::after {
  border: none !important;
  border-width: 0 !important;
  background: transparent !important;
}
.ctb-item:active {
  transform: scale(0.8);
  background: rgba(58, 122, 254, 0.08);
}
.icon { 
  font-size: 28rpx; 
  line-height: 1; 
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  filter: grayscale(1) opacity(0.6);
}
.icon.active {
  transform: scale(1.2);
  filter: grayscale(0) opacity(1);
}
.label { 
  font-size: 28rpx; 
  font-weight: 800; 
  color: #94a3b8; /* 未选中为灰 */
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: visible;
}
.label.active { 
  transform: scale(1.2);
  color: #0953e9; /* 选中为主色 */
}
</style>

