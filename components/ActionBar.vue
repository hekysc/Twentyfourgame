<template>
  <view class="grid2">
    <button class="clay-button" style="padding:24rpx;" @tap="$emit('undo')">
      <text class="text-lg bold">Undo</text>
    </button>
    <button class="clay-button-primary" style="padding:24rpx;" @tap="$emit('submit')">
      <text class="text-lg bold" style="color:#fff;">Submit</text>
    </button>
  </view>
</template>

<script>
export default { name:'ActionBar' }
</script>
