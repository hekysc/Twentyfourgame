<template>
  <view class="page" style="padding:24rpx; display:flex; flex-direction:column; gap:18rpx;"
        @touchstart="swipeStart" @touchmove="swipeMove" @touchend="swipeEnd">
    <view class="section">
      <view class="row" style="justify-content:space-between; align-items:center; gap:12rpx; flex-wrap:wrap;">
        <text class="title">玩家总览</text>
        <view class="row" style="display:flex; align-items:center; gap:12rpx;">
          <view class="seg">
            <button class="seg-btn" :class="{ active: overviewRange===1 }" @click="setOverviewRange(1)">今天</button>
            <button class="seg-btn" :class="{ active: overviewRange===3 }" @click="setOverviewRange(3)">3天</button>
            <button class="seg-btn" :class="{ active: overviewRange===7 }" @click="setOverviewRange(7)">7天</button>
            <button class="seg-btn" :class="{ active: overviewRange===30 }" @click="setOverviewRange(30)">30天</button>
            <button class="seg-btn" :class="{ active: overviewRange===0 }" @click="setOverviewRange(0)">全部</button>
          </view>
        </view>
      </view>
      <view class="table">
        <view class="thead">
          <text class="th rank">#</text>
          <text class="th user" @click="sortBy('name')" :class="{ active: sortKey==='name' }">用户</text>
          <text class="th">总局数</text>
          <text class="th ok">成
            <text>/
              <text class="th fail">败
              </text>
            </text>
          </text>
          <text class="th" @click="sortBy('winRate')" :class="{ active: sortKey==='winRate' }">🎯胜率</text>
          <text class="th">平均</text>
          <text class="th">🏆最佳</text>
        </view>
        <view class="tbody">
          <view class="tr" v-for="(row, i) in overviewRowsSorted" :key="row.id" @click="selectUser(row.id)">
            <text class="td rank">{{ i+1 }}</text>
            <text class="td user">{{ row.name }}</text>
            <text class="td">{{ row.times }}</text>
            <text class="td ok">{{ row.success }}
              <text>/
                <text class="td fail">{{ row.fail }}
                </text>
              </text>
            </text>
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
      <!-- <view class="table" style="margin-top:12rpx;">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
          <text class="th">窗口</text>
          <text class="th">滚动胜率</text>
          <text class="th">滚动平均用时</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
            <text class="td">7天</text>
            <text class="td">{{ rolling.win7 }}%</text>
            <text class="td">{{ rolling.avg7 }}</text>
          </view>
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
            <text class="td">30天</text>
            <text class="td">{{ rolling.win30 }}%</text>
            <text class="td">{{ rolling.avg30 }}</text>
          </view>
        </view>
      </view> -->
      <view class="table" style="margin-top:12rpx;">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)' }">
          <text class="th">当前连胜</text>
          <text class="th">最长连胜</text>
          <text class="th">当前连败</text>
          <text class="th">最长连败</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)' }">
            <text class="td ok">{{ streakStats.curWin }}</text>
            <text class="td ok">{{ streakStats.maxWin }}</text>
            <text class="td fail">{{ streakStats.curLose }}</text>
            <text class="td fail">{{ streakStats.maxLose }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">最近战绩</text>
      </view>
      <view class="rounds">
        <view v-for="r in recentRounds" :key="r.id" class="round-item compact3">
          <text class="r-time">{{ fmtTs(r.ts) }}</text>
          <text class="r-result" :class="{ ok: r.success, fail: !r.success }">{{ r.success ? '成功' : '失败' }}</text>
          <text class="r-timeMs">{{ (r.timeMs != null && Number.isFinite(r.timeMs)) ? ((r.timeMs/1000).toFixed(1) + 's') : '-' }}</text>
        </view>
      </view>
    </view>

    <!-- 错误近似度与差一点榜 -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">差一点榜（错误近似度）</text>
      </view>
      <view class="table" v-if="nearMisses.length">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'200rpx 1fr 160rpx 160rpx' }">
          <text class="th" style="width:200rpx">时间</text>
          <text class="th">表达式</text>
          <text class="th">结果</text>
          <text class="th">偏差</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'200rpx 1fr 160rpx 160rpx' }" v-for="(m,i) in nearMisses" :key="i">
            <text class="td" style="width:200rpx">{{ fmtTs(m.ts) }}</text>
            <text class="td" style="text-align:left">{{ m.expr }}</text>
            <text class="td">{{ m.value }}</text>
            <text class="td" :style="{color: m.diff>0?'#2563eb':'#dc2626', fontWeight:'700'}">{{ m.diff>0? ('+'+m.diff.toFixed(3)) : m.diff.toFixed(3) }}</text>
          </view>
        </view>
      </view>
      <view v-else style="color:#64748b; font-size:26rpx; margin-top:8rpx;">暂无可展示的错误记录</view>
      <!-- 近似度分布摘要 -->
      <view class="table" style="margin-top:12rpx;">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)' }">
          <text class="th">错误样本</text>
          <text class="th">|24-值| 中位</text>
          <text class="th">P90</text>
          <text class="th"><1 占比</text>
          <text class="th"><0.1 占比</text>
          <text class="th">偏上/偏下</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)' }">
            <text class="td">{{ nearSummary.count }}</text>
            <text class="td">{{ nearSummary.median }}</text>
            <text class="td">{{ nearSummary.p90 }}</text>
            <text class="td">{{ nearSummary.lt1 }}%</text>
            <text class="td">{{ nearSummary.lt01 }}%</text>
            <text class="td">{{ nearSummary.biasUp }}% / {{ nearSummary.biasDown }}%</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 首运算符成功率 + 运算熵 -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">运算偏好与效率</text>
        <text style="color:#64748b; font-size:26rpx;">运算熵：{{ opStats.entropyPct }}%</text>
      </view>
      <view class="table">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'120rpx 1fr 1fr 1fr 1fr' }">
          <text class="th">运算符</text>
          <text class="th">总出现</text>
          <text class="th">首运算-局数</text>
          <text class="th">首运算-胜率</text>
          <text class="th">可视化</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'120rpx 1fr 1fr 1fr 1fr' }" v-for="o in ['+','-','×','÷']" :key="o">
            <text class="td">{{ o }}</text>
            <text class="td">{{ opStats.allCounts[o] }}</text>
            <text class="td">{{ opStats.first[o].total }}</text>
            <text class="td">{{ opStats.first[o].total ? Math.round(100*opStats.first[o].success/opStats.first[o].total) : 0 }}%</text>
            <view class="td" style="padding:0 8rpx">
              <MiniBar :pct="opStats.first[o].total ? Math.round(100*opStats.first[o].success/opStats.first[o].total) : 0" />
            </view>
          </view>
        </view>
      </view>
      <!-- 运算序列偏好 bigram/trigram + 首两步 -->
      <view class="table" style="margin-top:12rpx;">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
          <text class="th">Top 序列</text>
          <text class="th">局数</text>
          <text class="th">胜率</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in seqStats.topBigrams" :key="'b-'+r.key">
            <text class="td">{{ r.key }}</text>
            <text class="td">{{ r.total }}</text>
            <text class="td">{{ r.win }}%</text>
          </view>
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in seqStats.topTrigrams" :key="'t-'+r.key">
            <text class="td">{{ r.key }}</text>
            <text class="td">{{ r.total }}</text>
            <text class="td">{{ r.win }}%</text>
          </view>
        </view>
      </view>
      <view class="table" style="margin-top:12rpx;">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
          <text class="th">首两步</text>
          <text class="th">局数</text>
          <text class="th">胜率</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in seqStats.firstTwo" :key="'f2-'+r.key">
            <text class="td">{{ r.key }}</text>
            <text class="td">{{ r.total }}</text>
            <text class="td">{{ r.win }}%</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 牌型签名命中率（Top 5） -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">牌型签名命中率（Top 5）</text>
      </view>
      <view class="table" v-if="faceSignStats.length">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr' }">
          <text class="th">签名</text>
          <text class="th">局数</text>
          <text class="th">成功</text>
          <text class="th">胜率</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr' }" v-for="r in faceSignStats" :key="r.sig">
            <text class="td">{{ r.sig }}</text>
            <text class="td">{{ r.total }}</text>
            <text class="td ok">{{ r.success }}</text>
            <text class="td">{{ r.win }}%</text>
          </view>
        </view>
      </view>
      <view v-else style="color:#64748b; font-size:26rpx; margin-top:8rpx;">暂无统计</view>
    </view>

    <!-- 难度热力（列表版）：Top/Bottom -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">难度热力（Top/Bottom）</text>
        <text style="color:#64748b; font-size:24rpx;">样本门槛：{{ faceHeat.minTotal }} 局</text>
      </view>
      <view class="row" style="display:grid; grid-template-columns:1fr 1fr; gap:12rpx; margin-top:8rpx;">
        <view class="table">
          <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
            <text class="th">Top 容易</text>
            <text class="th">局数</text>
            <text class="th">胜率</text>
          </view>
          <view class="tbody">
            <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in faceHeat.top" :key="'top-'+r.sig">
              <text class="td">{{ r.sig }}</text>
              <text class="td">{{ r.total }}</text>
              <text class="td ok">{{ r.win }}%</text>
            </view>
          </view>
        </view>
        <view class="table">
          <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
            <text class="th">Bottom 困难</text>
            <text class="th">局数</text>
            <text class="th">胜率</text>
          </view>
          <view class="tbody">
            <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in faceHeat.bottom" :key="'bot-'+r.sig">
              <text class="td">{{ r.sig }}</text>
              <text class="td">{{ r.total }}</text>
              <text class="td fail">{{ r.win }}%</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 称号系统（基础版） -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">称号</text>
      </view>
      <view style="display:flex; flex-wrap:wrap; gap:8rpx; margin-top:8rpx;">
        <text v-for="(b,i) in badges" :key="i" style="padding:6rpx 12rpx; background:#f1f5f9; border-radius:20rpx; font-size:26rpx;">{{ b }}</text>
      </view>
    </view>

    <!-- 速度-准确概览（时间分桶） -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">速度-准确概览</text>
      </view>
      <view class="table">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr' }">
          <text class="th">时间段</text>
          <text class="th">总数</text>
          <text class="th">成功</text>
          <text class="th">失败</text>
          <text class="th">成功率</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr' }" v-for="b in speedBuckets" :key="b.label">
            <text class="td">{{ b.label }}</text>
            <text class="td">{{ b.total }}</text>
            <text class="td ok">{{ b.success }}</text>
            <text class="td fail">{{ b.fail }}</text>
            <view class="td" style="padding:0 8rpx">
              <MiniBar :pct="b.total ? Math.round(100*b.success/b.total) : 0" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 技能雷达（表格版） -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">技能雷达（表格版）</text>
      </view>
      <view class="table">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }">
          <text class="th">技能</text>
          <text class="th">使用占比</text>
          <text class="th">胜率</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr' }" v-for="r in skillsRadar" :key="r.key">
            <text class="td">{{ r.label }}</text>
            <text class="td">{{ r.usePct }}%</text>
            <text class="td">{{ r.winPct }}%</text>
          </view>
        </view>
      </view>
    </view>
  </view>
  <CustomTabBar />
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import CustomTabBar from '../../components/CustomTabBar.vue'
import MiniBar from '../../components/MiniBar.vue'
import MicroSpark from '../../components/MicroSpark.vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { ensureInit, allUsersWithStats, readStatsExtended } from '../../utils/store.js'

const rows = ref([]) // 基础用户列表（不含筛选数据）
const overviewRange = ref(1) // 默认“今天”：1 / 3 / 7 / 30 / 0（0=全部；其余为“今天+前N-1天”）
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
  try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}
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
function setOverviewRange(d = 0){
  // 若未传参则激活“今天”；显式传 0 仍表示“全部”
  overviewRange.value = (arguments.length === 0 ? 1 : d)
}

function startOfTodayMs(){
  const d = new Date()
  d.setHours(0,0,0,0)
  return d.getTime()
}
function calcCutoffMs(){
  const d = Number(overviewRange.value)
  if (!d || d <= 0) return 0
  const day = 86400000
  // 包含“今天”在内的近 d 天：从本地今天 00:00 起，往前推 (d-1) 天
  return startOfTodayMs() - (d - 1) * day
}
function goUser(){ try { uni.reLaunch({ url:'/pages/user/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/user/index' }) } catch(_){} } }
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
  const cutoff = calcCutoffMs()
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
    const cutoff = calcCutoffMs()
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
  const cutoff = calcCutoffMs()
  const items = rows.value.map(u => {
    const rec = userExtMap.value[u.id] || { rounds: [], agg: {} }
    const rounds = (rec.rounds||[]).filter(r => (!cutoff || (r.ts||0) >= cutoff))
    const total = rounds.length
    const success = rounds.filter(r=>r.success).length
    const winRate = total ? Math.round(100 * success / total) : 0
    const times = rounds.filter(r=>r.success && Number.isFinite(r.timeMs)).map(r=>r.timeMs)
    const bestTimeMs = times.length ? Math.min(...times) : null
    const avgTimeMs = times.length ? Math.round(times.reduce((a,b)=>a+b,0) / times.length) : null
    const fail = total - success
    return { id: u.id, name: u.name, total, success, fail, times: total, winRate, bestTimeMs, avgTimeMs }
  })
  items.sort((a,b)=> (b.winRate - a.winRate) || (b.times - a.times))
  return items
})

// ========== 首批 4 项：计算逻辑 ==========
const currentRounds = computed(() => {
  const uid = selectedUserId.value
  const rec = uid ? (userExtMap.value[uid] || { rounds: [] }) : { rounds: [] }
  const cutoff = calcCutoffMs()
  const arr = (rec.rounds || [])
  return cutoff > 0 ? arr.filter(r => (r.ts||0) >= cutoff) : arr.slice()
})

function evalExprToNumber(expr){
  if (!expr || typeof expr !== 'string') return null
  // 仅允许数字/空格/小数点/括号/+-×÷
  const cleaned = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'')
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null
  try {
    // 使用 Function 计算，表达式来源受控，已白名单替换
    // 防止诸如 "1/0" 返回 Infinity：这里统一返回 null 以便跳过
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict";return(${cleaned})`)()
    return (typeof val === 'number' && Number.isFinite(val)) ? val : null
  } catch (_) { return null }
}

// 1) 错误近似度画像与“差一点”榜
const nearMisses = computed(() => {
  const rows = []
  for (const r of currentRounds.value) {
    if (r && !r.success && typeof r.expr === 'string') {
      const v = evalExprToNumber(r.expr)
      if (v == null) continue
      const diff = v - 24
      const abs = Math.abs(diff)
      rows.push({ ts: r.ts||0, expr: r.expr, value: v, diff, abs })
    }
  }
  rows.sort((a,b)=> a.abs - b.abs)
  return rows.slice(0, 5)
})

function percentile(sortedArray, p){
  if (!sortedArray.length) return 0
  const idx = Math.min(sortedArray.length - 1, Math.max(0, Math.ceil((p/100) * sortedArray.length) - 1))
  return +sortedArray[idx].toFixed(3)
}
const nearSummary = computed(() => {
  const diffs = [] // { abs, sign }
  for (const r of currentRounds.value) {
    if (r && !r.success && typeof r.expr === 'string') {
      const v = evalExprToNumber(r.expr)
      if (v == null) continue
      const d = v - 24
      diffs.push({ abs: Math.abs(d), sign: Math.sign(d) })
    }
  }
  const absArr = diffs.map(x=>x.abs).sort((a,b)=>a-b)
  const count = absArr.length
  if (!count) return { count:0, median: '-', p90:'-', lt1:0, lt01:0, biasUp:0, biasDown:0 }
  const median = percentile(absArr, 50)
  const p90 = percentile(absArr, 90)
  const lt1 = Math.round(100 * (absArr.filter(x=>x<1).length / count))
  const lt01 = Math.round(100 * (absArr.filter(x=>x<0.1).length / count))
  const up = diffs.filter(x=>x.sign>0).length
  const down = diffs.filter(x=>x.sign<0).length
  const total = up + down
  const biasUp = total ? Math.round(100 * up / total) : 0
  const biasDown = total ? Math.round(100 * down / total) : 0
  return { count, median, p90, lt1, lt01, biasUp, biasDown }
})

// 2) 首运算符成功率 + 运算熵
const opStats = computed(() => {
  const ops = ['+','-','×','÷']
  const first = Object.fromEntries(ops.map(o => [o, { total:0, success:0 }]))
  const allCounts = Object.fromEntries(ops.map(o => [o, 0]))
  for (const r of currentRounds.value) {
    const seq = Array.isArray(r?.ops) ? r.ops : []
    if (seq.length) {
      const f = seq[0]
      if (first[f]) { first[f].total += 1; if (r.success) first[f].success += 1 }
    }
    for (const o of seq) { if (allCounts[o] != null) allCounts[o] += 1 }
  }
  const totalOps = Object.values(allCounts).reduce((a,b)=>a+b,0)
  let entropy = 0
  if (totalOps > 0) {
    for (const o of ops) {
      const p = allCounts[o] / totalOps
      if (p > 0) entropy += -p * Math.log2(p)
    }
  }
  const entropyMax = Math.log2(4) // 最多 4 类运算符
  const entropyPct = entropyMax ? Math.round((entropy/entropyMax)*100) : 0
  return { first, allCounts, totalOps, entropy, entropyPct }
})

// 运算序列偏好（bigram/trigram）与首两步
const seqStats = computed(() => {
  const big = new Map() // key -> { total, success }
  const tri = new Map()
  const firstTwo = new Map()
  const add = (map, key, success) => {
    if (!key) return
    const cur = map.get(key) || { total:0, success:0 }
    cur.total += 1; if (success) cur.success += 1
    map.set(key, cur)
  }
  for (const r of currentRounds.value) {
    const seq = Array.isArray(r?.ops) ? r.ops : []
    const ok = !!r?.success
    if (seq.length >= 2) add(firstTwo, `${seq[0]} → ${seq[1]}`, ok)
    for (let i=0;i+1<seq.length;i++) add(big, `${seq[i]} ${seq[i+1]}`, ok)
    for (let i=0;i+2<seq.length;i++) add(tri, `${seq[i]} ${seq[i+1]} ${seq[i+2]}`, ok)
  }
  const toRows = (map) => Array.from(map.entries()).map(([key,v])=>({ key, total:v.total, win: v.total ? Math.round(100*v.success/v.total) : 0 }))
  const byTotal = (a,b)=> (b.total - a.total) || (b.win - a.win)
  const topBigrams = toRows(big).sort(byTotal).slice(0,6)
  const topTrigrams = toRows(tri).sort(byTotal).slice(0,6)
  const firstTwoRows = toRows(firstTwo).sort(byTotal).slice(0,6)
  return { topBigrams: topBigrams, topTrigrams: topTrigrams, firstTwo: firstTwoRows }
})

// ========== 趋势与连胜 ==========
const streakStats = computed(() => {
  // 在当前时间窗口内计算连胜/连败
  const arr = (currentRounds.value || []).slice().sort((a,b)=> (a.ts||0)-(b.ts||0))
  let curWin = 0, maxWin = 0, curLose = 0, maxLose = 0
  for (const r of arr) {
    if (r.success) {
      curWin += 1; if (curWin > maxWin) maxWin = curWin
      curLose = 0
    } else {
      curLose += 1; if (curLose > maxLose) maxLose = curLose
      curWin = 0
    }
  }
  return { curWin, maxWin, curLose, maxLose }
})

// ========== 技能雷达（表格版） ==========
const skillsRadar = computed(() => {
  const rounds = currentRounds.value || []
  const total = rounds.length || 1
  const mk = (key, label, pred) => {
    let t = 0, ok = 0
    for (const r of rounds) {
      const yes = !!pred(r)
      if (yes) { t += 1; if (r.success) ok += 1 }
    }
    const usePct = Math.round(100 * (t / total))
    const winPct = t ? Math.round(100 * (ok / t)) : 0
    return { key, label, usePct, winPct }
  }
  const hasOp = (r, op) => Array.isArray(r?.ops) && r.ops.includes(op)
  const hasParen = (r) => typeof r?.expr === 'string' && /[()]/.test(r.expr)
  const hasFraction = (r) => {
    if (typeof r?.expr === 'string' && /[.]/.test(r.expr)) return true
    if (typeof r?.expr === 'string' && /[÷/]/.test(r.expr)) return true
    const v = typeof r?.expr === 'string' ? evalExprToNumber(r.expr) : null
    return (v != null && Math.abs(v - Math.round(v)) > 1e-9)
  }
  return [
    mk('plus','＋ 加法', r=>hasOp(r,'+')),
    mk('minus','－ 减法', r=>hasOp(r,'-')),
    mk('mul','× 乘法', r=>hasOp(r,'×')),
    mk('div','÷ 除法', r=>hasOp(r,'÷') || (typeof r?.expr==='string' && r.expr.includes('/'))),
    mk('paren','括号', hasParen),
    mk('frac','分数', hasFraction),
  ]
})

// ========== 滚动指标 ==========
const dailySeries = computed(() => {
  const rounds = filteredRounds.value
  const byDay = new Map() // day -> { total, success, successTimes: [] }
  for (const r of rounds) {
    const key = new Date(r.ts||0).toISOString().slice(0,10)
    const cur = byDay.get(key) || { total:0, success:0, successTimes: [] }
    cur.total += 1; if (r.success) { cur.success += 1; if (Number.isFinite(r.timeMs)) cur.successTimes.push(r.timeMs) }
    byDay.set(key, cur)
  }
  return Array.from(byDay.entries()).sort((a,b)=> a[0]<b[0]? -1: 1)
})
function rollingOf(windowDays){
  const days = dailySeries.value
  if (!days.length) return { win:0, avg:'-' }
  const tail = days.slice(-windowDays)
  const total = tail.reduce((a,[,v])=>a+v.total,0)
  const success = tail.reduce((a,[,v])=>a+v.success,0)
  const times = tail.flatMap(([,v])=>v.successTimes)
  const win = total ? Math.round(100*success/total) : 0
  const avg = times.length ? fmtMs(Math.round(times.reduce((a,b)=>a+b,0)/times.length)) : '-'
  return { win, avg }
}
const rolling = computed(() => ({
  win7: rollingOf(7).win,
  win30: rollingOf(30).win,
  avg7: rollingOf(7).avg,
  avg30: rollingOf(30).avg,
}))

const spark7 = computed(() => {
  const days = dailySeries.value.slice(-7)
  return days.map(([,v]) => ({ rate: v.total ? (v.success/v.total) : 0 }))
})
const spark30 = computed(() => {
  const days = dailySeries.value.slice(-30)
  return days.map(([,v]) => ({ rate: v.total ? (v.success/v.total) : 0 }))
})

// ========== 难度热力（Top/Bottom 列表版） ==========
const faceHeat = computed(() => {
  const minTotal = 2
  const map = new Map()
  for (const r of currentRounds.value) {
    const sig = handSignature(r?.hand)
    if (!sig) continue
    const cur = map.get(sig) || { total:0, success:0 }
    cur.total += 1; if (r.success) cur.success += 1
    map.set(sig, cur)
  }
  const rows = Array.from(map.entries()).map(([sig, v])=>{
    const win = v.total ? Math.round(100*v.success/v.total) : 0
    return { sig, total:v.total, success:v.success, win }
  }).filter(r => r.total >= minTotal)
  const top = rows.slice().sort((a,b)=> (b.win - a.win) || (b.total - a.total)).slice(0,5)
  const bottom = rows.slice().sort((a,b)=> (a.win - b.win) || (b.total - a.total)).slice(0,5)
  return { top, bottom, minTotal }
})

// ========== 称号系统（基础规则） ==========
const badges = computed(() => {
  const out = []
  const rounds = currentRounds.value || []
  const total = rounds.length
  const success = rounds.filter(r=>r.success).length
  const winRate = total ? (100*success/total) : 0
  // 多样探索者/单核惯性
  if (opStats.value.entropyPct >= 75) out.push('多样探索者')
  else if (opStats.value.entropyPct <= 35) out.push('单核惯性')
  // 乘法信徒
  const opsTotal = Math.max(1, opStats.value.totalOps)
  if ((opStats.value.allCounts['×']||0)/opsTotal >= 0.4) out.push('乘法信徒')
  // 精准狙击：错误近似 |24-值| < 1 的占比 >= 50%
  if ((nearSummary.value.count>0) && (nearSummary.value.lt1 >= 50)) out.push('精准狙击')
  // 分数恐惧症：分数技能胜率比总胜率低 >= 20pt
  const frac = (skillsRadar.value || []).find(x=>x.key==='frac')
  if (frac && frac.usePct>0 && (winRate - frac.winPct) >= 20) out.push('分数恐惧症')
  // 逆转之王：成功中 retries>=1 的占比 >= 50%
  const succWithRetries = rounds.filter(r=>r.success && Number.isFinite(r.retries) && r.retries>0).length
  const succTotal = rounds.filter(r=>r.success).length || 1
  if (succWithRetries/succTotal >= 0.5 && succTotal>=4) out.push('逆转之王')
  // 极速手/磨刀匠
  const succTimes = rounds.filter(r=>r.success && Number.isFinite(r.timeMs)).map(r=>r.timeMs)
  const best = succTimes.length ? Math.min(...succTimes) : Infinity
  if (best <= 1500) out.push('极速手')
  const avgRetriesAll = (rounds.filter(r=>Number.isFinite(r.retries)).reduce((a,b)=>a+b.retries,0) / Math.max(1, rounds.filter(r=>Number.isFinite(r.retries)).length)) || 0
  if (avgRetriesAll >= 1 && winRate >= 50) out.push('磨刀匠')
  return out
})

// 3) 牌型签名命中率
function handSignature(hand){
  try {
    const cs = (hand && Array.isArray(hand.cards)) ? hand.cards : []
    const ranks = cs.map(c => +c.rank).filter(n => Number.isFinite(n)).sort((a,b)=>a-b)
    return ranks.join(',')
  } catch (_) { return '' }
}
const faceSignStats = computed(() => {
  const map = new Map() // sig -> { total, success }
  for (const r of currentRounds.value) {
    const sig = handSignature(r?.hand)
    if (!sig) continue
    const cur = map.get(sig) || { total:0, success:0 }
    cur.total += 1; if (r.success) cur.success += 1
    map.set(sig, cur)
  }
  const rows = Array.from(map.entries()).map(([sig, v])=>{
    const win = v.total ? Math.round(100 * v.success / v.total) : 0
    return { sig, total: v.total, success: v.success, win }
  })
  rows.sort((a,b)=> (b.total - a.total) || (b.win - a.win))
  return rows.slice(0, 5)
})

// 4) 速度-准确散点（用时间分桶概览代替复杂图表）
const speedBuckets = computed(() => {
  const buckets = [
    { key:'<1s', min:0, max:1000 },
    { key:'1-2s', min:1000, max:2000 },
    { key:'2-5s', min:2000, max:5000 },
    { key:'5-10s', min:5000, max:10000 },
    { key:'10-30s', min:10000, max:30000 },
    { key:'≥30s', min:30000, max:Infinity },
  ]
  const rows = buckets.map(b=>({ label:b.key, total:0, success:0, fail:0 }))
  for (const r of currentRounds.value) {
    if (!Number.isFinite(r?.timeMs)) continue
    const t = r.timeMs
    const i = buckets.findIndex(b => t >= b.min && t < b.max)
    if (i < 0) continue
    rows[i].total += 1
    if (r.success) rows[i].success += 1; else rows[i].fail += 1
  }
  return rows
})

// —— 玩家总览：表头排序 ——
const SORT_STORE_KEY = 'tf24_overview_sort_v1'
const sortKey = ref('winRate') // 默认按胜率
const sortDir = ref('desc')    // 胜率默认降序

try {
  const raw = uni.getStorageSync && uni.getStorageSync(SORT_STORE_KEY)
  const cfg = raw && (typeof raw === 'string' ? JSON.parse(raw) : raw)
  if (cfg && cfg.key && cfg.dir && (cfg.dir === 'asc' || cfg.dir === 'desc')) {
    sortKey.value = cfg.key
    sortDir.value = cfg.dir
  }
} catch (_) {}

function persistSort(){
  try { uni.setStorageSync && uni.setStorageSync(SORT_STORE_KEY, JSON.stringify({ key: sortKey.value, dir: sortDir.value })) } catch(_) {}
}

function sortBy(key){
  const defaultDir = (key === 'name' || key === 'avgTimeMs' || key === 'bestTimeMs') ? 'asc' : 'desc'
  if (sortKey.value !== key) {
    sortKey.value = key
    sortDir.value = defaultDir
  } else {
    sortDir.value = (sortDir.value === 'asc') ? 'desc' : 'asc'
  }
  persistSort()
}

const overviewRowsSorted = computed(() => {
  try {
    const rows = Array.isArray(overviewRows) ? overviewRows : (overviewRows?.value || [])
    const list = [...rows]
    const key = sortKey.value
    const dir = sortDir.value
    const sign = dir === 'asc' ? 1 : -1
    list.sort((a,b) => {
      const av = a?.[key]
      const bv = b?.[key]
      if (key === 'name') {
        const as = String(av || '')
        const bs = String(bv || '')
        return as.localeCompare(bs, 'zh') * sign
      }
      const na = Number.isFinite(av) ? av : -Infinity
      const nb = Number.isFinite(bv) ? bv : -Infinity
      if (na === nb) return 0
      return (na > nb ? 1 : -1) * sign
    })
    return list
  } catch(_) { return [] }
})

// —— 左右滑动切换 Tab ——
const swipeTracking = ref(false)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const swipeDX = ref(0)
const swipeDY = ref(0)

function swipeStart(e){
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    swipeTracking.value = true
    swipeStartX.value = t.clientX || t.pageX || 0
    swipeStartY.value = t.clientY || t.pageY || 0
    swipeDX.value = 0
    swipeDY.value = 0
  } catch(_) {}
}
function swipeMove(e){
  if (!swipeTracking.value) return
  try {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const x = t.clientX || t.pageX || 0
    const y = t.clientY || t.pageY || 0
    swipeDX.value = x - swipeStartX.value
    swipeDY.value = y - swipeStartY.value
  } catch(_) {}
}
function swipeEnd(){
  if (!swipeTracking.value) return
  swipeTracking.value = false
  const dx = swipeDX.value
  const dy = swipeDY.value
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absX > 60 && absX > absY * 1.5) {
    if (dx < 0) {
      navigateTab('/pages/index/index')
    }
  }
}
function navigateTab(url){
  const done = () => {}
  if (uni && typeof uni.switchTab === 'function') {
    uni.switchTab({ url, success: done, fail(){
      if (typeof uni.navigateTo === 'function') {
        uni.navigateTo({ url, success: done, fail(){
          if (typeof uni.reLaunch === 'function') {
            uni.reLaunch({ url, success: done, fail: done })
          } else { done() }
        } })
      } else if (typeof uni.reLaunch === 'function') {
        uni.reLaunch({ url, success: done, fail: done })
      } else { done() }
    } })
  } else if (typeof uni.navigateTo === 'function') {
    uni.navigateTo({ url, success: done, fail(){
      if (typeof uni.reLaunch === 'function') {
        uni.reLaunch({ url, success: done, fail: done })
      } else { done() }
    } })
  } else if (typeof uni.reLaunch === 'function') {
    uni.reLaunch({ url, success: done, fail: done })
  }
}
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
  grid-template-columns: 40rpx 1fr 120rpx 120rpx 80rpx 80rpx 80rpx; 
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
/* 数值列居中对齐，更紧凑 */
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
.rounds{ margin-top:12rpx; display:flex; flex-direction:column; row-gap:16rpx }
.round-item{ display:grid; grid-template-columns: 200rpx 120rpx 160rpx 1fr; grid-gap:8rpx; padding:8rpx 4rpx; border-top:2rpx solid #eef2f7 }
.round-item.compact3{ grid-template-columns: 200rpx 120rpx 160rpx }
.r-time, .r-result, .r-timeMs {
  font-size: 26rpx;
  font-weight: 600;
  color: #1e293b;
}
.r-result.ok{ color:#16a34a; font-weight:700 }
.r-result.fail{ color:#dc2626; font-weight:700 }
.picker-trigger{ padding:8rpx 14rpx; background:#f1f5f9; border-radius:12rpx }

/* 表头排序：高亮当前列 */
.th.active{ color:#0953e9; font-weight:800 }

</style>
