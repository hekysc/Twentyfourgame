<template>
  <view class="bar-track" :style="{ height: size+'rpx', background: trackColor }">
    <view class="bar-fill" :style="{ width: pct + '%', background: color }"></view>
  </view>
</template>

<script setup>
const props = defineProps({
  pct: { type: Number, default: 0 },
  color: { type: String, default: '#16a34a' },
  trackColor: { type: String, default: '#e5e7eb' },
  size: { type: Number, default: 14 },
})
</script>

<style scoped>
.bar-track{ width:100%; border-radius:9999rpx; overflow:hidden }
.bar-fill{ height:100%; border-radius:9999rpx }
</style>

