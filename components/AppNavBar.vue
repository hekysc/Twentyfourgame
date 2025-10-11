<!--
  AppNavBar
  顶部导航栏组件，提供返回按钮、标题与右侧插槽。
  Props: title, showBack, withSafeTop, background, backToIndex。
-->
<template>
  <view class="app-nav-bar" :style="navStyle">
    <view class="nav-inner">
      <view class="nav-side nav-left">
        <view v-if="showBack" class="back-btn" hover-class="back-btn-hover" @tap="handleBack">
          <text class="back-icon">←</text>
        </view>
        <slot name="left"></slot>
      </view>
      <view class="nav-title">
        <slot name="title">
          <text class="nav-title-text">{{ title }}</text>
        </slot>
      </view>
      <view class="nav-side nav-right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useSafeArea } from '../utils/useSafeArea.js'
import { navigateToHome } from '../utils/navigation.js'

const props = defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  withSafeTop: { type: Boolean, default: true },
  background: { type: String, default: '#ffffff' },
  backToIndex: { type: Boolean, default: true },
})

const emit = defineEmits(['back'])
const { safeTop } = useSafeArea()

const navStyle = computed(() => {
  const paddingTop = props.withSafeTop ? Math.max(0, safeTop.value || 0) : 0
  return {
    paddingTop: paddingTop + 'px',
    background: props.background,
  }
})

function handleBack() {
  // 先触发自定义事件
  emit('back')
  
  // 如果需要返回首页
  if (props.backToIndex) {
    navigateToHome()
  } else {
    // 普通返回
    uni.navigateBack({
      delta: 1,
      fail: (err) => {
        console.log('navigateBack 失败，尝试返回首页:', err)
        // 如果返回失败，尝试回到首页
        uni.switchTab({
          url: '/pages/index/index',
          fail: () => {
            uni.reLaunch({ url: '/pages/index/index' })
          }
        })
      }
    })
  }
}
</script>

<style scoped>
.app-nav-bar {
  width: 100%;
  box-sizing: border-box;
  position: relative;
  background: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.08);
}

.app-nav-bar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(15, 23, 42, 0.06);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
}

.nav-title {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-align: center;
}

.nav-title-text {
  max-width: 70%;
  font-size: 34rpx;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-side {
  min-width: 96rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.nav-right {
  justify-content: flex-end;
}

.back-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 80rpx;
  background: rgba(17, 24, 39, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.18s ease;
}

.back-btn-hover {
  background: rgba(17, 24, 39, 0.16);
}

.back-icon {
  font-size: 34rpx;
  color: #111827;
  font-weight: 700;
  transform: translateX(-4rpx);
}
</style>
