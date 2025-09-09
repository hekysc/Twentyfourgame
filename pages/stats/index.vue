<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:18rpx;">
    <view class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">玩家总览</text>
        <button class="btn mini" @click="goUser">管理用户</button>
      </view>
      <view class="table">
        <view class="thead">
          <text class="th rank">#</text>
          <text class="th user">用户</text>
          <text class="th">总局</text>
          <text class="th ok">成功</text>
          <text class="th fail">失败</text>
          <text class="th">胜率</text>
        </view>
        <view class="tbody">
          <view class="tr" v-for="(row, i) in rows" :key="row.id">
            <text class="td rank">{{ i+1 }}</text>
            <text class="td user">{{ row.name }}</text>
            <text class="td">{{ row.totals.total }}</text>
            <text class="td ok">{{ row.totals.success }}</text>
            <text class="td fail">{{ row.totals.fail }}</text>
            <text class="td">{{ row.winRate }}%</text>
          </view>
        </view>
      </view>
    </view>
  </view>
  
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ensureInit, allUsersWithStats } from '../../utils/store.js'

const rows = ref([])

onMounted(() => { ensureInit(); load() })

function load(){
  const list = allUsersWithStats()
  list.sort((a,b)=> (b.winRate - a.winRate) || (b.totals.total - a.totals.total))
  rows.value = list
}
function goUser(){ try { uni.switchTab({ url:'/pages/user/index' }) } catch(_){} }
</script>

<style scoped>
.section{ background:#fff; border:2rpx solid #e5e7eb; border-radius:16rpx; padding:16rpx; box-shadow:0 6rpx 16rpx rgba(15,23,42,.06) }
.title{ font-size:32rpx; font-weight:800 }
.table{ margin-top:12rpx }
.thead, .tr{ display:grid; grid-template-columns: 80rpx 1fr 140rpx 140rpx 140rpx 140rpx; align-items:center; gap:8rpx }
.thead{ color:#6b7280; font-weight:700; padding:8rpx 12rpx }
.tr{ padding:12rpx; border-top:2rpx solid #eef2f7 }
.th, .td{ text-align:left }
.rank{ text-align:center }
.ok{ color:#16a34a; font-weight:700 }
.fail{ color:#dc2626; font-weight:700 }
.btn.mini{ padding:10rpx 16rpx; border-radius:12rpx; background:#eef2f7 }
</style>
