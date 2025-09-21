<template>
  <view class="claymorphism card" style="margin-bottom:24rpx; align-items:center;">
    <text class="text-6xl text-shadow-strong" style="color:#fff; font-weight:800; margin-bottom:16rpx;">{{ number }}</text>
    <view class="claymorphism-inset" style="width:100%; height:16rpx; border-radius:9999rpx; background:var(--surface-dark);">
      <view :style="barStyle"></view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BigNumber',
  props: { number: {type:[String,Number], default: 18}, progress: {type:Number, default: 0.75} },
  computed:{
    barStyle(){
      const p = Math.max(0, Math.min(1, this.progress))*100 + '%'
      return `width:${p}; height:100%; background:var(--accent2); border-radius:9999rpx;`
    }
  }
}
</script>
