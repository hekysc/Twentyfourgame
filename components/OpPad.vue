<template>
  <view class="grid4" style="margin-bottom:32rpx;">
    <button v-for="(op,i) in ops" :key="i" class="clay-button center" style="height:96rpx;" @tap="$emit('tap-op', op)">
      <text :class="[op.length>1?'text-3xl':'text-4xl']" style="font-weight:700;">{{ op }}</text>
    </button>
  </view>
</template>

<script>
export default {
  name:'OpPad',
  props:{ ops:{ type:Array, default:()=>['+','-','×','÷'] } }
}
</script>
