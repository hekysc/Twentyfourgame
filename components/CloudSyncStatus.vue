<template>
  <view
    v-if="online"
    class="cloud-sync"
    :class="displayStatus"
    @tap.stop="retry"
  >
    <view class="cloud-sync-dot" :class="displayStatus"></view>
    <text>{{ label }}</text>
  </view>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { isOnline } from '../utils/identity.js'
import { getCloudSyncStatus, retryCloudSync } from '../utils/online.js'

const props = defineProps({
  online: { type: Boolean, default: undefined },
  busy: { type: Boolean, default: false },
})
const status = ref(getCloudSyncStatus())
const online = computed(() => props.online ?? isOnline())
const displayStatus = computed(() => (props.busy ? 'syncing' : status.value.status))
const label = computed(() => {
  if (displayStatus.value === 'syncing') return '同步中'
  if (displayStatus.value === 'error') return status.value.retryable ? '同步失败 · 点击重试' : '同步失败'
  return '已同步'
})
function onStatusChange(value) {
  status.value = value || { status: 'synced', retryable: false }
}
function retry() {
  if (displayStatus.value === 'error' && status.value.retryable) retryCloudSync().catch(() => {})
}
onMounted(() => {
  if (typeof uni !== 'undefined') uni.$on('tf24:sync-status', onStatusChange)
})
onUnmounted(() => {
  if (typeof uni !== 'undefined') uni.$off('tf24:sync-status', onStatusChange)
})
</script>

<style scoped>
.cloud-sync {
  display: inline-flex;
  align-items: center;
  gap: 7rpx;
  color: #738077;
  font-size: 20rpx;
  line-height: 1.2;
  white-space: nowrap;
}
.cloud-sync.syncing { color: #947747; }
.cloud-sync.error { color: #a34036; }
.cloud-sync-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #4b896d;
  flex: 0 0 auto;
}
.cloud-sync-dot.syncing {
  background: #c39236;
  animation: pulse 1s ease-in-out infinite;
}
.cloud-sync-dot.error { background: #b34c40; }
@keyframes pulse { 50% { opacity: .35; } }
</style>
