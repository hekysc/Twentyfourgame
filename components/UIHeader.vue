<template>
  <view class="row" style="justify-content:space-between; align-items:center; margin-bottom:32rpx;">
    <view class="row" style="align-items:center; gap: 16rpx;" @tap="$emit('tap-avatar')">
      <view class="claymorphism center" style="width:112rpx; height:112rpx; background: var(--accent1);">
        <image
          v-if="avatar"
          :src="avatar"
          mode="aspectFill"
          style="width:80rpx;height:80rpx;border-radius:9999rpx;"
          @error="$emit('avatar-error')"
        ></image>
        <view v-else class="center" style="width:80rpx;height:80rpx;border-radius:9999rpx;background:#fff;">🙂</view>
      </view>
      <view class="col">
        <text class="text-sm" style="color:var(--text-dark);">Player</text>
        <text class="text-2xl" style="color:var(--primary-dark); font-weight:700;">{{ username }}</text>
      </view>
    </view>

    <button class="clay-button" style="padding: 16rpx; min-width:96rpx;" @tap="$emit('tap-settings')">
      <view class="row center" style="gap:8rpx;">
        <text style="font-size:40rpx;">⚙️</text>
        <text class="text-sm" style="color:var(--text-dark);">设置</text>
      </view>
    </button>
  </view>
</template>

<script>
export default {
  name: 'UIHeader',
  props: { username: { type: String, default: 'PlayerOne' }, avatar: { type: String, default: '' } }
}
</script>

<style scoped></style>
