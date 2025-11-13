<!--
  Icon Insights
  渲染基于字符的图标。通过 props.size / props.color 控制外观。
  适用于无法使用内置图标库时的占位符。
-->
<template>
  <!-- 基于纯文本字符的图标容器 -->
  <text class="icon-text">=</text>
</template>

<script setup>
// 接收尺寸与颜色，适配不同场景的视觉需求
const props = defineProps({
  size: { type: Number, default: 28 },
  color: { type: String, default: '#111827' }
})
</script>

<style scoped>
.icon-text {
  font-size: v-bind('props.size + "px"');
  color: v-bind('props.color');
  line-height: 1;
}
</style>
