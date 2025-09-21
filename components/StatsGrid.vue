<template>
  <view class="claymorphism-inset card" style="margin-bottom:24rpx;">
    <view class="grid2">
      <view class="claymorphism card" style="text-align:center;">
        <text class="text-sm bold">Score</text>
        <text class="text-3xl" style="color:var(--primary-dark); display:block;">{{ score }}</text>
      </view>
      <view class="claymorphism card" style="text-align:center;">
        <text class="text-sm bold">Time</text>
        <text class="text-3xl" style="color:var(--text-dark); display:block;">{{ time }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'StatsGrid',
  props: { score: {type:[String,Number],default:1250}, time: {type:String, default:'12:34'} }
}
</script>
