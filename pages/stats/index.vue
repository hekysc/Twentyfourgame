<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:18rpx;">
    <view class="section">
      <view class="row" style="justify-content:space-between; align-items:center; gap:12rpx; flex-wrap:wrap;">
        <text class="title">玩家总览</text>
        <view class="row" style="display:flex; align-items:center; gap:12rpx;">
          <view class="seg">
            <button class="seg-btn" :class="{ active: overviewRange===7 }" @click="setOverviewRange(7)">近7天</button>
            <button class="seg-btn" :class="{ active: overviewRange===30 }" @click="setOverviewRange(30)">近30天</button>
            <button class="seg-btn" :class="{ active: overviewRange===0 }" @click="setOverviewRange(0)">全部</button>
          </view>
        </view>
      </view>
      <view class="table">
        <view class="thead">
          <text class="th rank">排名</text>
          <text class="th user">用户</text>
          <text class="th">总局数</text>
          <text class="th ok">成功</text>
          <text class="th">🎯胜率</text>
          <text class="th">平均</text>
          <text class="th">🏆最佳</text>
        </view>
        <view class="tbody">
          <view class="tr" v-for="(row, i) in overviewRows" :key="row.id" @click="selectUser(row.id)">
            <text class="td rank">{{ i+1 }}</text>
            <text class="td user">{{ row.name }}</text>
            <text class="td">{{ row.times }}</text>
            <text class="td ok">{{ row.success }}</text>
            <text class="td">{{ row.winRate }}%</text>
            <text class="td">{{ row.avgTimeMs != null ? fmtMs(row.avgTimeMs) : '-' }}</text>
            <text class="td">{{ row.bestTimeMs != null ? fmtMs(row.bestTimeMs) : '-' }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center; gap:12rpx; flex-wrap: wrap;">
        <text class="title">📈个人趋势</text>
        <view class="user-picker" style="display:flex; align-items:center; gap:8rpx;">
          <text style="color:#6b7280; font-size:26rpx;">查看</text>
          <picker :range="userOptions" range-key="name" @change="onUserChange">
            <view class="picker-trigger">{{ selectedUserLabel }}</view>
          </picker>
        </view>
        
      </view>
      <view class="trend" style="margin-top:12rpx; height:160rpx; display:flex; align-items:flex-end; gap:6rpx;">
        <view v-for="(d,i) in trendBars" :key="i" class="bar"
              :style="{ height: (d.height||4) + 'rpx', background: d.color }"></view>
      </view>
      <view class="trend-legend" style="margin-top:8rpx; color:#6b7280; font-size:24rpx;">绿色=成功占比，灰色=无数据</view>
    </view>

    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">最近战绩</text>
      </view>
      <view class="rounds">
        <view v-for="r in recentRounds" :key="r.id" class="round-item">
          <text class="r-time">{{ fmtTs(r.ts) }}</text>
          <text class="r-result" :class="{ ok: r.success, fail: !r.success }">{{ r.success ? '成功' : '失败' }}</text>
          <text class="r-timeMs">{{ r.timeMs != null ? (r.timeMs + 'ms') : '-' }}</text>
          <text class="r-meta">{{ (r.faceUseHigh ? 'JQK高位' : 'JQK低位') + ' · ' + (r.hintUsed ? '用提示' : '无提示') }}</text>
        </view>
      </view>
    </view>
  </view>
  
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { ensureInit, allUsersWithStats, readStatsExtended } from '../../utils/store.js'

const rows = ref([]) // 基础用户列表（不含筛选数据）
const overviewRange = ref(7) // 7 / 30 / 0（全局范围，作用于总览与趋势）
// 备注：面牌/提示筛选已移除，仅保留全局时间筛选
const hintFilter = ref('all') // all | hint | nohint（全局）
// 用户选择与扩展数据载入
const selectedUserId = ref('')
const userOptions = computed(() => rows.value.map(r => ({ id: r.id, name: r.name })))
const selectedUserLabel = computed(() => (userOptions.value.find(o => o.id === selectedUserId.value)?.name) || '请选择用户')
const userExtMap = ref({}) // { uid: { rounds, totals, agg, days } }
const userMap = computed(() => {
  const map = {}
  for (const r of rows.value) map[r.id] = { id:r.id, name:r.name }
  return map
})
// 单用户兼容：保留 ext 但内部来源于 userExtMap
const ext = ref({ totals:{ total:0, success:0, fail:0 }, days:{}, rounds:[], agg:{} })

onMounted(() => {
  ensureInit();
  load();
  loadExt()
})

onShow(() => {
  load();
  loadExt();
})

onPullDownRefresh(() => {
  try {
    load();
    loadExt();
  } finally {
    try { uni.stopPullDownRefresh && uni.stopPullDownRefresh() } catch (_) {}
  }
})

function load(){
  const list = allUsersWithStats()
  list.sort((a,b)=> (b.winRate - a.winRate) || (b.totals.total - a.totals.total))
  rows.value = list
}
function loadExt(){
  // 总览与趋势都需要：始终加载所有用户扩展数据
  const map = {}
  for (const u of rows.value) {
    map[u.id] = readStatsExtended(u.id)
  }
  userExtMap.value = map
  // 兼容 ext：用于单用户场景下的直接绑定
  const uid = selectedUserId.value
  ext.value = map[uid] || { totals:{ total:0, success:0, fail:0 }, days:{}, rounds:[], agg:{} }
}
function selectUser(uid){ selectedUserId.value = uid || ''; loadExt(); try { uni.pageScrollTo && uni.pageScrollTo({ selector: '.trend', duration: 200 }) } catch(_){} }
function onUserChange(e){ try { const idx = e?.detail?.value|0; const opt = userOptions.value[idx]; if (opt){ selectedUserId.value = opt.id; loadExt() } } catch(_){} }
function setOverviewRange(d){ overviewRange.value = d }
function goUser(){ try { uni.switchTab({ url:'/pages/user/index' }) } catch(_){} }
function fmtTs(ts){ try { const d=new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` } catch(_) { return '-' } }
function fmtMs(ms){ if (!Number.isFinite(ms)) return '-'; if (ms < 1000) return ms + 'ms'; const s = ms/1000; if (s<60) return s.toFixed(1)+'s'; const m = Math.floor(s/60); const r = Math.round(s%60); return `${m}m${r}s` }

const activeRounds = computed(() => {
  const uid = selectedUserId.value
  if (uid === 'all') {
    const arr = []
    for (const id of Object.keys(userExtMap.value || {})) {
      const rec = userExtMap.value[id]
      const list = (rec?.rounds || []).map(r => ({ ...r, uid: id }))
      arr.push(...list)
    }
    return arr.sort((a,b)=> (b.ts||0)-(a.ts||0))
  } else {
    const rec = userExtMap.value[uid] || { rounds: [] }
    return (rec.rounds || []).map(r => ({ ...r, uid }))
  }
})
const filteredRounds = computed(() => {
  const list = activeRounds.value
  const cutoff = (overviewRange.value && overviewRange.value > 0) ? (Date.now() - overviewRange.value*86400000) : 0
  return list.filter(r => (!cutoff || (r.ts||0) >= cutoff))
})
const recentRounds = computed(() => filteredRounds.value.slice(0, 12).map(r => ({ ...r, user: userMap.value[r.uid] })))

const trendBars = computed(() => {
  // 取天级分布：基于 rounds 计算（更精确地考虑筛选）
  const rounds = filteredRounds.value
  const byDay = new Map()
  for (const r of rounds) {
    const key = new Date(r.ts||0).toISOString().slice(0,10)
    const cur = byDay.get(key) || { total:0, success:0 }
    cur.total += 1; if (r.success) cur.success += 1
    byDay.set(key, cur)
  }
  let days = Array.from(byDay.entries()).sort((a,b)=> a[0]<b[0]? -1: 1)
  if (overviewRange.value>0) {
    const cutoff = Date.now() - overviewRange.value*86400000
    days = days.filter(([k]) => new Date(k+'T00:00:00Z').getTime() >= cutoff)
  }
  // 至多展示 30 根柱
  days = days.slice(-30)
  const maxTotal = Math.max(1, ...days.map(([,v])=>v.total))
  return days.map(([k,v])=>{
    const h = Math.max(4, Math.round(120 * (v.total/maxTotal)))
    const rate = v.total ? (v.success / v.total) : 0
    const color = v.total ? '#16a34a' : '#e5e7eb'
    return { label: k, height: Math.max(6, Math.round(h*rate)), color }
  })
})
// 玩家总览：按筛选范围/提示/面牌统计并按胜率排序
const overviewRows = computed(() => {
  const cutoff = (overviewRange.value && overviewRange.value > 0) ? (Date.now() - overviewRange.value*86400000) : 0
  const items = rows.value.map(u => {
    const rec = userExtMap.value[u.id] || { rounds: [], agg: {} }
    const rounds = (rec.rounds||[]).filter(r => (!cutoff || (r.ts||0) >= cutoff))
    const total = rounds.length
    const success = rounds.filter(r=>r.success).length
    const winRate = total ? Math.round(100 * success / total) : 0
    const times = rounds.filter(r=>r.success && Number.isFinite(r.timeMs)).map(r=>r.timeMs)
    const bestTimeMs = times.length ? Math.min(...times) : null
    const avgTimeMs = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : null
    return { id: u.id, name: u.name, total, success, times: total, winRate, bestTimeMs, avgTimeMs }
  })
  items.sort((a,b)=> (b.winRate - a.winRate) || (b.times - a.times))
  return items
})
</script>

<style scoped>
.section{ background:#fff; border:2rpx solid #e5e7eb; border-radius:16rpx; padding:16rpx; box-shadow:0 6rpx 16rpx rgba(15,23,42,.06) }
.title{ font-size:32rpx; font-weight:800 }
.table { 
  margin-top: 12rpx; 
  border-radius: 12rpx; 
  overflow: hidden; 
  border: 1rpx solid #e5e7eb; 
}
.thead, .tr { 
  display: grid; 
  grid-template-columns: 60rpx 1fr 80rpx 80rpx 80rpx 120rpx 120rpx; 
  align-items: center; 
  grid-gap: 6rpx; 
  min-height: 44rpx;
}
.thead { 
  color: #6b7280; 
  font-weight: 700; 
  padding: 8rpx 12rpx; 
  background: #f8fafc;
  font-size: 24rpx;
}
.tr { 
  padding: 10rpx 12rpx; 
  border-top: 1rpx solid #f1f5f9;
  font-size: 26rpx;
  transition: background-color 0.2s;
}
.th, .td { 
  text-align: center; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  white-space: nowrap;
  line-height: 1.4;
}
.rank { 
  text-align: center; 
  font-weight: 600;
}
.td.rank {
  color: #64748b;
  font-size: 24rpx;
}

.td.user {
  font-weight: 600;
  color: #1e293b;
}
.ok { 
  color: #059669; 
  font-weight: 700; 
}

.fail { 
  color: #dc2626; 
  font-weight: 700; 
}
/* 数值列居右对齐，更紧凑 */
.th:nth-child(3), .th:nth-child(4), .th:nth-child(5), .th:nth-child(6), .th:nth-child(7),
.td:nth-child(3), .td:nth-child(4), .td:nth-child(5), .td:nth-child(6), .td:nth-child(7) {
  text-align: center;
}

/* 胜率列特殊样式 */
.td:nth-child(5) {
  font-weight: 600;
  color: #0891b2;
}

/* 最佳成绩列特殊样式 */
.td:nth-child(7) {
  font-weight: 600;
  color: #7c3aed;
}
.btn.mini{ padding:10rpx 16rpx; border-radius:12rpx; background:#eef2f7 }
.btn.link{ background:transparent; color:#2563eb }
.seg{ display:flex; background:#f1f5f9; border-radius:12rpx; overflow:hidden }
.seg-btn{ padding:10rpx 16rpx; background:transparent; border:none }
.seg-btn.active{ background:#fff; font-weight:700 }
.trend .bar{ width:18rpx; border-radius:8rpx; background:#e5e7eb }
.rounds{ margin-top:12rpx; display:flex; flex-direction:column; row-gap:8rpx }
.round-item{ display:grid; grid-template-columns: 200rpx 120rpx 160rpx 1fr; grid-gap:8rpx; padding:8rpx 4rpx; border-top:2rpx solid #eef2f7 }
.r-result.ok{ color:#16a34a; font-weight:700 }
.r-result.fail{ color:#dc2626; font-weight:700 }
.picker-trigger{ padding:8rpx 14rpx; background:#f1f5f9; border-radius:12rpx }

</style>
