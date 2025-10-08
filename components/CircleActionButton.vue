<template>
  <view class="circle-button" :class="{ disabled }">
    <view class="circle-button-shell">
      <view
        class="circle-button-core"
        :class="[{ danger, primary }, disabled ? 'circle-button-disabled' : '']"
        hover-class="circle-button-hover"
        :hover-start-time="20"
        :hover-stay-time="120"
        @tap="handleTap"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
        @longpress="showTooltip"
      >
        <uni-icons :type="icon" :color="iconColor" :size="iconSize" />
      </view>
      <view v-if="tooltipVisible" class="circle-button-tooltip">{{ label }}</view>
    </view>
    <text v-if="label" class="circle-button-label">{{ label }}</text>
  </view>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'

const props = defineProps({
  icon: { type: String, default: 'help' },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
  primary: { type: Boolean, default: false },
  iconColor: { type: String, default: '#111827' },
  iconSize: { type: Number, default: 28 },
})

const emit = defineEmits(['tap'])

const tooltipVisible = ref(false)
let tooltipTimer = null

function handleTap() {
  if (props.disabled) return
  emit('tap')
}

function showTooltip() {
  if (!props.label) return
  tooltipVisible.value = true
  clearTimer()
  tooltipTimer = setTimeout(() => {
    tooltipVisible.value = false
  }, 1200)
}

function handleTouchStart() {
  clearTimer()
}

function handleTouchEnd() {
  clearTimer()
  tooltipVisible.value = false
}

function clearTimer() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
  }
}

onBeforeUnmount(() => clearTimer())
</script>

<style scoped>
.circle-button {
  position: relative;
  width: 88rpx;
  min-height: 88rpx;
  margin: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.circle-button-shell {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle-button-core {
  width: 88rpx;
  height: 88rpx;
  border-radius: 9999rpx;
  background: #ffffff;
  border: 2rpx solid rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.08);
}

.circle-button-core.circle-button-disabled {
  opacity: 0.4;
  box-shadow: none;
}

.circle-button-core.primary {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  border-color: transparent;
}

.circle-button-core.primary uni-icons {
  color: #ffffff !important;
}

.circle-button-core.danger {
  background: linear-gradient(135deg, #ef4444, #f87171);
  border-color: transparent;
}

.circle-button-core.danger uni-icons {
  color: #ffffff !important;
}

.circle-button.disabled {
  opacity: 0.6;
}

.circle-button-hover {
  transform: scale(0.98);
}

.circle-button-label {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #1f2937;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.circle-button-tooltip {
  position: absolute;
  bottom: 104rpx;
  background: rgba(15, 23, 42, 0.92);
  color: #ffffff;
  font-size: 24rpx;
  padding: 8rpx 16rpx;
  border-radius: 9999rpx;
  white-space: nowrap;
  opacity: 0.94;
  pointer-events: none;
  animation: tooltip-in 120ms ease-out;
}

@keyframes tooltip-in {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 0.94; transform: translateY(0); }
}
</style>
