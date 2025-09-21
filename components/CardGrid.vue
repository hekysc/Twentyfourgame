<template>
  <view class="grid4" style="margin-bottom:24rpx;">
    <view v-for="(item,idx) in items" :key="idx"
          class="clay-button center h120"
          :class="[{ 'opacity-50': item.disabled }]"
          @tap="$emit('tap-item', item)">
      <text class="text-5xl" style="color:var(--text-dark);">{{ item.label }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name:'CardGrid',
  props:{ items:{ type:Array, default:()=>[
    {label:'8'},{label:'Q',disabled:true},{label:'6'},{label:'8',disabled:true}
  ]}}
}
</script>
