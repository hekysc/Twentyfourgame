<template>
  <view class="app-nav-bar" :style="navStyle">
    <view class="nav-inner">
      <view class="nav-side nav-left">
        <view v-if="showBack" class="back-btn" hover-class="back-btn-hover" @tap="handleBack">
          <uni-icons type="back" color="#1f2937" size="22" />
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

const props = defineProps({
  title: { type: String, default: '' },
  showBack: { type: Boolean, default: false },
  withSafeTop: { type: Boolean, default: true },
  background: { type: String, default: '#f8f8f8' },
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
  if (emit) emit('back')
  try {
    uni.switchTab({ url: '/pages/index/index' })
  } catch (err) {
    try { uni.reLaunch({ url: '/pages/index/index' }) } catch (_) {}
  }
}
</script>

<style scoped>
.app-nav-bar {
  width: 100%;
  padding-bottom: 16rpx;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.nav-title {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 64rpx;
}

.nav-title-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
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
  width: 72rpx;
  height: 72rpx;
  border-radius: 72rpx;
  background: rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn-hover {
  background: rgba(15, 23, 42, 0.12);
}
</style>
