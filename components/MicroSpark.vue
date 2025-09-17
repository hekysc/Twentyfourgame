<template>
  <view class="spark" :style="{ height: height+'rpx' }">
    <view v-for="(v,i) in norm" :key="i" class="seg" :class="{ ok: v.ok }" :style="{ height: Math.max(2, Math.round(v.h*height)) + 'rpx' }"></view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ values: { type: Array, default: () => [] }, height: { type: Number, default: 24 } })
const norm = computed(() => {
  const arr = Array.isArray(props.values) ? props.values : []
  // 每项：{ rate: 0..1 }
  return arr.map(x => {
    const r = Math.max(0, Math.min(1, Number(x?.rate)||0))
    return { h: r, ok: r>=0.5 }
  })
})
</script>

<style scoped>
.spark{ display:flex; align-items:flex-end; gap:2rpx }
.seg{ width:6rpx; border-radius:2rpx; background:#94a3b8 }
.seg.ok{ background:#16a34a }
</style>

