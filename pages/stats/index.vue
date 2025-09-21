<template>
  <view
    class="page"
    style="padding:24rpx; display:flex; flex-direction:column; gap:18rpx;"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >
    <view class="section overview-section">
      <view class="panel-header">
        <text class="title">玩家总览</text>
        <view class="panel-actions">
          <view class="seg">
            <button class="seg-btn" :class="{ active: overviewRange===1 }" @click="setOverviewRange(1)">今天</button>
            <button class="seg-btn" :class="{ active: overviewRange===3 }" @click="setOverviewRange(3)">3天</button>
            <button class="seg-btn" :class="{ active: overviewRange===7 }" @click="setOverviewRange(7)">7天</button>
            <button class="seg-btn" :class="{ active: overviewRange===30 }" @click="setOverviewRange(30)">30天</button>
            <button class="seg-btn" :class="{ active: overviewRange===0 }" @click="setOverviewRange(0)">全部</button>
          </view>
        </view>
      </view>
      <view class="grid-table overview-table">
        <view class="thead">
          <text class="th rank">排名</text>
          <text class="th user" @click="sortBy('name')" :class="{ active: sortKey==='name' }">玩家</text>
          <text class="th win" @click="sortBy('winRate')" :class="{ active: sortKey==='winRate' }">胜率</text>
          <text class="th streak" @click="sortBy('maxWin')" :class="{ active: sortKey==='maxWin' }">连胜</text>
          <text class="th total" @click="sortBy('times')" :class="{ active: sortKey==='times' }">场次</text>
          <text class="th time" @click="sortBy('avgTimeMs')" :class="{ active: sortKey==='avgTimeMs' }">平均/最佳</text>
        </view>
        <view class="tbody">
          <view class="tr" v-for="row in overviewDisplayRows" :key="row.id" @click="selectUser(row.id)">
            <view class="td rank">
              <text v-if="row.rankBadge" class="rank-medal">{{ row.rankBadge }}</text>
              <text class="rank-index">#{{ row.index + 1 }}</text>
            </view>
            <view class="td user">
              <view class="user-main">
                <text class="tier-icon" :style="{ backgroundColor: row.tier.color }">{{ row.tier.icon }}</text>
                <view class="user-meta">
                  <text class="user-name">{{ row.name }}</text>
                  <text class="user-tier">{{ row.tier.label }}</text>
                </view>
              </view>
            </view>
            <view class="td win">
              <text class="stat-value text-win">{{ row.winRate }}%</text>
              <view class="stacked-bar small">
                <view class="seg win" :style="{ width: row.successPct + '%' }"></view>
                <view class="seg fail" :style="{ width: row.failPct + '%' }"></view>
              </view>
              <text class="stat-sub">胜 {{ row.success }} · 败 {{ row.fail }}</text>
            </view>
            <view class="td streak">
              <view class="streak-pill current">
                <text class="pill-label">当前</text>
                <text class="pill-value">{{ row.currentWin }}</text>
              </view>
              <view class="streak-pill longest">
                <text class="pill-label">最长</text>
                <text class="pill-value">{{ row.maxWin }}</text>
              </view>
            </view>
            <view class="td total">
              <text class="stat-value">{{ row.total }}</text>
              <text class="stat-sub">胜率 {{ row.winRate }}%</text>
            </view>
            <view class="td time">
              <text class="stat-value">{{ row.avgTimeText }}</text>
              <text class="stat-sub">最佳 {{ row.bestTimeText }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="selectedUserId" class="section title">
      <view class="user-picker" style="display:flex; align-items:center; gap:8rpx;">
        <!-- <text style="color:#6b7280; font-size:26rpx;">查看</text> -->
        <picker :range="userOptions" range-key="name" @change="onUserChange">
          <view class="picker-trigger">{{ selectedUserLabel }}</view>
        </picker>
      </view>
    </view>

    <view v-if="selectedUserId" class="section trend-section">
      <view class="panel-header">
        <text class="title">📈个人趋势</text>
        <view class="trend-chips">
          <view class="stat-chip">
            <text class="chip-label">段位</text>
            <view class="chip-value tier">
              <text class="tier-icon" :style="{ backgroundColor: selectedTier.color }">{{ selectedTier.icon }}</text>
              <text>{{ selectedTier.label }}</text>
            </view>
          </view>
          <view class="stat-chip">
            <text class="chip-label">窗口胜率</text>
            <text class="chip-value text-win">{{ currentWindowSummary.winPct }}%</text>
          </view>
          <view class="stat-chip">
            <text class="chip-label">当前连胜</text>
            <text class="chip-value text-win">{{ streakStats.curWin }}</text>
          </view>
          <view class="stat-chip">
            <text class="chip-label">最长连胜</text>
            <text class="chip-value text-accent">{{ streakStats.maxWin }}</text>
          </view>
        </view>
      </view>

      <view class="panel-slot trend-summary" v-if="currentWindowSummary.total">
        <view class="stacked-bar big">
          <view class="seg win" :style="{ width: currentWindowSummary.winPct + '%' }"></view>
          <view class="seg fail" :style="{ width: Math.max(0, 100 - currentWindowSummary.winPct) + '%' }"></view>
        </view>
        <view class="trend-meta">
          <text class="meta text-win">胜 {{ currentWindowSummary.success }}</text>
          <text class="meta text-fail">败 {{ currentWindowSummary.fail }}</text>
          <text class="meta muted">共 {{ currentWindowSummary.total }} 局</text>
        </view>
      </view>

      <view class="trend-chart panel-slot">
        <view class="trend-chart-inner"
              :style="{ width: trendSeries.width ? (trendSeries.width + 'rpx') : '100%', height: trendSeries.chartHeight + 'rpx' }">
          <view class="trend-bars"
                :style="{ gap: trendSeries.gap + 'rpx', width: trendSeries.width ? (trendSeries.width + 'rpx') : '100%' }">
            <view v-for="(d,i) in trendSeries.items" :key="d.label || i" class="trend-item"
                  :style="{ width: trendSeries.barWidth + 'rpx' }">
              <view class="bar" :style="{ height: d.totalHeight + 'rpx' }">
                <view class="bar-fail" :style="{ height: d.failHeight + 'rpx' }"></view>
                <view class="bar-success" :style="{ height: d.successHeight + 'rpx' }"></view>
              </view>
            </view>
          </view>
        </view>
        <view class="trend-labels" :class="{ rotate: rotateDates }"
              :style="{ gap: trendSeries.gap + 'rpx', width: trendSeries.width ? (trendSeries.width + 'rpx') : '100%' }">
          <text v-for="(d,i) in trendSeries.items" :key="'label-'+i" class="bar-label"
                :style="{ width: trendSeries.barWidth + 'rpx' }">{{ d.shortLabel }}</text>
        </view>
      </view>
      <view class="trend-legend panel-hint">绿色=胜利局数，红色=失败局数</view>

      <view class="panel-slot rank-progress">
        <view class="rank-progress-bar stacked-bar">
          <view class="seg rank" :style="{ width: selectedTier.progressPct + '%' }"></view>
        </view>
        <view class="rank-progress-meta">
          <text class="meta">段位进度 {{ selectedTier.progressPct }}%</text>
          <text class="meta muted">{{ tierAdvancementHint.text }}</text>
        </view>
      </view>

      <view class="grid-table streak-table panel-slot">
        <view class="thead">
          <text class="th">当前连胜</text>
          <text class="th">最长连胜</text>
          <text class="th">当前连败</text>
          <text class="th">最长连败</text>
        </view>
        <view class="tbody">
          <view class="tr">
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
        <view v-for="r in (recentRounds || []).slice().reverse()" :key="r.id" class="round-item">
          <text class="r-time">{{ fmtTs(r.ts) }}</text>
          <text class="r-result" :class="{ ok: r.success, fail: !r.success }">{{ r.success ? '成功' : '失败' }}</text>
          <text class="r-timeMs">{{ (r.timeMs != null && Number.isFinite(r.timeMs)) ? ((r.timeMs/1000).toFixed(1) + 's') : '-' }}</text>
          <text class="r-cards">{{ r.cardsText }}</text>
        </view>
      </view>
    </view>

    <view v-if="selectedUserId" class="section mistakes-section">
      <view class="panel-header">
        <text class="title">📝错题本</text>
        <text class="mistake-tip">连续正确 5 次将自动移出活动错题本（但仍计入总错题统计）</text>
      </view>
      <view class="mistake-summary panel-slot">
        <view class="mistake-summary-item">
          <text class="mistake-summary-label">错题总数</text>
          <text class="mistake-summary-value">{{ mistakeSummary.totalWrongCount }}</text>
        </view>
        <view class="mistake-summary-item active">
          <text class="mistake-summary-label">遗留错题</text>
          <text class="mistake-summary-value">{{ mistakeSummary.totalActiveCount }}</text>
        </view>
        <view v-if="mistakeProgress.total" class="mistake-progress">
          <view class="stacked-bar small">
            <view class="seg warn" :style="{ width: mistakeProgress.activePct + '%' }"></view>
            <view class="seg calm" :style="{ width: mistakeProgress.clearedPct + '%' }"></view>
          </view>
          <view class="mistake-progress-meta">
            <text class="meta text-warn">活动 {{ mistakeProgress.active }}</text>
            <text class="meta text-calm">清除 {{ mistakeProgress.cleared }}</text>
          </view>
        </view>
      </view>
      <view class="mistake-controls panel-slot">
        <label class="mistake-filter">
          <switch :checked="mistakeFilterActiveOnly" @change="onToggleMistakeActive" color="#145751" />
          <text>仅看活动</text>
        </label>
        <view class="mistake-sort seg">
          <button class="seg-btn" :class="{ active: mistakeSortKey==='errorRate' }" @click="setMistakeSort('errorRate')">错误率</button>
          <button class="seg-btn" :class="{ active: mistakeSortKey==='attempts' }" @click="setMistakeSort('attempts')">次数</button>
          <button class="seg-btn" :class="{ active: mistakeSortKey==='streak' }" @click="setMistakeSort('streak')">连对</button>
        </view>
      </view>
      <view class="grid-table mistake-table panel-slot" v-if="mistakeDisplayRows.length">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'220rpx 120rpx 120rpx 120rpx 120rpx 120rpx 120rpx 200rpx' }">
          <text class="th" style="text-align:left;">题目 key</text>
          <text class="th">尝试</text>
          <text class="th fail">错</text>
          <text class="th ok">对</text>
          <text class="th">错误率</text>
          <text class="th">连对</text>
          <text class="th">活动</text>
          <text class="th">最近练习</text>
        </view>
        <view class="tbody">
          <view class="tr" v-for="row in mistakeDisplayRows" :key="row.key" :style="{ display:'grid', gridTemplateColumns:'220rpx 120rpx 120rpx 120rpx 120rpx 120rpx 120rpx 200rpx' }">
            <text class="td" style="text-align:left;">{{ row.displayKey }}</text>
            <text class="td">{{ row.attempts }}</text>
            <text class="td fail">{{ row.wrong }}</text>
            <text class="td ok">{{ row.correct }}</text>
            <text class="td">{{ row.errorRate }}%</text>
            <text class="td">{{ row.streak }}</text>
            <text class="td" :class="{ ok: row.active }">{{ row.active ? '是' : '否' }}</text>
            <text class="td">{{ row.lastSeenText }}</text>
          </view>
        </view>
      </view>
      <view v-else class="panel-hint empty-hint">暂无错题记录</view>
    </view>

    <!-- 首运算符成功率 + 运算熵 -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">运算偏好与效率</text>
        <text style="color:#64748b; font-size:26rpx;">运算熵：{{ opStats.entropyPct }}%</text>
      </view>
      <view class="grid-table panel-slot operations-table">
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
      <view class="grid-table panel-slot operations-table">
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
      <view class="grid-table panel-slot operations-table">
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
      <view class="grid-table panel-slot table" v-if="faceSignStats.length">
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
      <view v-else class="panel-hint empty-hint">暂无统计</view>
    </view>

    <!-- 难度热力（列表版）：Top/Bottom -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">难度热力（Top/Bottom）</text>
        <text style="color:#64748b; font-size:24rpx;">样本门槛：{{ faceHeat.minTotal }} 局</text>
      </view>
      <view class="difficulty-heatmaps">
        <view class="grid-table table compact-table">
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
        <view class="grid-table table compact-table">
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
      <view class="grid-table panel-slot table">
        <view class="thead" :style="{ display:'grid', gridTemplateColumns:'1.5fr repeat(5, 1fr)' }">
          <text class="th">时间段</text>
          <text class="th">总数</text>
          <text class="th">成功</text>
          <text class="th">失败</text>
          <text class="th">成功率</text>
          <text class="th">平均用时</text>
        </view>
        <view class="tbody">
          <view class="tr" :style="{ display:'grid', gridTemplateColumns:'1.5fr repeat(5, 1fr)' }" v-for="b in speedBuckets" :key="b.label">
            <text class="td">{{ b.label }}</text>
            <text class="td">{{ b.total }}</text>
            <text class="td ok">{{ b.success }}</text>
            <text class="td fail">{{ b.fail }}</text>
            <view class="td" style="padding:0 8rpx">
              <MiniBar :pct="b.successRate" />
            </view>
            <text class="td">{{ b.avgTimeText }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 技能雷达（表格版） -->
    <view v-if="selectedUserId" class="section">
      <view class="row" style="justify-content:space-between; align-items:center;">
        <text class="title">技能雷达（表格版）</text>
      </view>
      <view class="grid-table panel-slot table">
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
    <view
      v-if="hintState.visible"
      class="floating-hint-layer"
      :class="{ interactive: hintState.interactive }"
      @tap="hideHint"
    >
      <view class="floating-hint" @tap.stop>{{ hintState.text }}</view>
    </view>
  </view>
  <CustomTabBar />
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import CustomTabBar from '../../components/CustomTabBar.vue'
import MiniBar from '../../components/MiniBar.vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { ensureInit, allUsersWithStats, readStatsExtended, getCurrentUser } from '../../utils/store.js'
import { loadMistakeBook, getSummary as getMistakeSummary } from '../../utils/mistakes.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { consumeAvatarRestoreNotice } from '../../utils/avatar.js'
import { exitApp } from '../../utils/navigation.js'
import {
  computeOverviewRows,
  summarizeNearMisses,
  computeOpStats,
  computeSeqStats,
  computeStreakStats,
  computeSkillsRadar,
  computeDailySeries,
  computeSparkSeries,
  computeFaceHeat,
  computeBadges,
  computeFaceSignStats,
  computeSpeedBuckets,
  resolveRankTier,
} from '../../utils/stats.js'

const SELECTED_USER_STORE_KEY = 'tf24_stats_selected_user_v1'

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
const { hintState, showHint, hideHint } = useFloatingHint()
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitStatsPage() })
// 单用户兼容：保留 ext 但内部来源于 userExtMap
const ext = ref({ totals:{ total:0, success:0, fail:0 }, days:{}, rounds:[], agg:{} })
// 日期标签旋转：当数据点较多时自动竖排，避免重叠
const rotateDates = computed(() => {
  try {
    const n = trendSeries.value?.items?.length || 0
    return n >= 1  // 当有7个或更多数据点时旋转
  } catch (_) { return false }
})

const mistakeBook = ref({ active: {}, ledger: {} })
const mistakeSummary = ref({ totalWrongCount: 0, totalActiveCount: 0 })
const mistakeFilterActiveOnly = ref(false)
const mistakeSortKey = ref('errorRate')

const mistakeRows = computed(() => {
  const book = mistakeBook.value || { active: {}, ledger: {} }
  const ledger = book.ledger || {}
  const activeKeys = new Set(Object.keys(book.active || {}))
  const rows = []
  for (const key of Object.keys(ledger)) {
    const item = ledger[key] || {}
    const attempts = Number.isFinite(item.attempts) ? Math.max(0, Math.floor(item.attempts)) : 0
    const wrong = Number.isFinite(item.wrong) ? Math.max(0, Math.floor(item.wrong)) : 0
    const correct = Number.isFinite(item.correct) ? Math.max(0, Math.floor(item.correct)) : 0
    const totalAttempts = attempts || (wrong + correct)
    const errorRate = totalAttempts ? Math.round((wrong / totalAttempts) * 100) : 0
    const streak = Number.isFinite(item.streakCorrect) ? Math.max(0, Math.floor(item.streakCorrect)) : 0
    const lastSeenTs = Number.isFinite(item.lastSeenTs) ? Math.floor(item.lastSeenTs) : 0
    const nums = Array.isArray(item.nums) ? item.nums : (typeof key === 'string' ? key.split(',').map(n => +n || 0) : [])
    rows.push({
      key: item.key || key,
      displayKey: (item.key || key || nums.join(',')),
      nums,
      attempts: totalAttempts,
      wrong,
      correct,
      errorRate,
      streak,
      active: activeKeys.has(key),
      lastSeenTs,
      lastSeenText: lastSeenTs ? fmtTs(lastSeenTs) : '-',
    })
  }
  rows.sort((a, b) => (b.lastSeenTs - a.lastSeenTs))
  return rows
})

const mistakeDisplayRows = computed(() => {
  let arr = mistakeRows.value.slice()
  if (mistakeFilterActiveOnly.value) {
    arr = arr.filter(r => r.active)
  }
  const sorter = mistakeSortKey.value
  const compare = (a, b) => {
    if (sorter === 'attempts') {
      return (b.attempts - a.attempts) || (b.errorRate - a.errorRate) || (b.lastSeenTs - a.lastSeenTs)
    }
    if (sorter === 'streak') {
      return (b.streak - a.streak) || (b.lastSeenTs - a.lastSeenTs)
    }
    return (b.errorRate - a.errorRate) || (b.attempts - a.attempts) || (b.lastSeenTs - a.lastSeenTs)
  }
  arr.sort(compare)
  return arr
})

const mistakeProgress = computed(() => {
  const total = Math.max(0, Number(mistakeSummary.value.totalWrongCount) || 0)
  const active = Math.max(0, Number(mistakeSummary.value.totalActiveCount) || 0)
  const cleared = Math.max(0, total - active)
  const activePct = total ? Math.round((active / total) * 100) : 0
  const clearedPct = total ? Math.max(0, 100 - activePct) : 0
  return { total, active, cleared, activePct, clearedPct }
})

onMounted(() => {
  try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}
  ensureInit();
  load();
  loadExt()
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
})

onShow(() => {
  load();
  loadExt();
  try { uni.$emit && uni.$emit('tabbar:update') } catch (_) {}
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
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
  applyDefaultSelectedUser(list)
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
  loadMistakeData()
}

function loadMistakeData(){
  const uid = selectedUserId.value
  if (!uid) {
    mistakeBook.value = { active: {}, ledger: {} }
    mistakeSummary.value = { totalWrongCount: 0, totalActiveCount: 0 }
    return
  }
  try {
    mistakeBook.value = loadMistakeBook(uid)
    mistakeSummary.value = getMistakeSummary(uid)
  } catch (_) {
    mistakeBook.value = { active: {}, ledger: {} }
    mistakeSummary.value = { totalWrongCount: 0, totalActiveCount: 0 }
  }
}

function loadStoredSelectedUserId(){
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const raw = uni.getStorageSync(SELECTED_USER_STORE_KEY)
      return typeof raw === 'string' ? raw : ''
    }
  } catch (_) {}
  return ''
}

function persistSelectedUserId(id){
  try {
    if (id) {
      if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
        uni.setStorageSync(SELECTED_USER_STORE_KEY, id)
      }
    } else if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
      uni.removeStorageSync(SELECTED_USER_STORE_KEY)
    }
  } catch (_) {}
}

function resolveDefaultSelectedUserId(list){
  const arr = Array.isArray(list) ? list : []
  if (!arr.length) return ''
  const stored = loadStoredSelectedUserId()
  if (stored && arr.some(u => u.id === stored)) return stored
  const current = getCurrentUser()
  if (current && arr.some(u => u.id === current.id)) return current.id
  return arr[0]?.id || ''
}

function applyDefaultSelectedUser(list){
  const arr = Array.isArray(list) ? list : []
  if (!arr.length) {
    if (selectedUserId.value) selectedUserId.value = ''
    persistSelectedUserId('')
    return
  }
  const current = selectedUserId.value
  if (current && arr.some(u => u.id === current)) {
    // 当前位置有效，确保存储同步
    persistSelectedUserId(current)
    return
  }
  const target = resolveDefaultSelectedUserId(arr)
  if (target && current !== target) {
    selectedUserId.value = target
  } else if (!target && current) {
    selectedUserId.value = ''
  }
  persistSelectedUserId(target)
}

watch(selectedUserId, (uid, prev) => {
  if (uid !== prev) {
    mistakeFilterActiveOnly.value = false
    mistakeSortKey.value = 'errorRate'
  }
  loadMistakeData()
  persistSelectedUserId(uid || '')
})
function selectUser(uid){
  selectedUserId.value = uid || '';
  persistSelectedUserId(selectedUserId.value)
  loadExt();
}
function onUserChange(e){ try { const idx = e?.detail?.value|0; const opt = userOptions.value[idx]; if (opt){ selectedUserId.value = opt.id; persistSelectedUserId(opt.id); loadExt() } } catch(_){} }
function setOverviewRange(d = 0){
  // 若未传参则激活“今天”；显式传 0 仍表示“全部”
  overviewRange.value = (arguments.length === 0 ? 1 : d)
}

function onToggleMistakeActive(e){
  mistakeFilterActiveOnly.value = !!(e?.detail?.value)
}

function setMistakeSort(key){
  mistakeSortKey.value = key
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

function normalizeCardRank(value){
  if (Number.isFinite(value)) return value
  const num = Number(value)
  if (Number.isFinite(num)) return num
  if (typeof value === 'string') {
    const key = value.trim().toUpperCase()
    if (key === 'A') return 1
    if (key === 'J') return 11
    if (key === 'Q') return 12
    if (key === 'K') return 13
  }
  return null
}

function extractRoundRanks(round){
  if (!round || typeof round !== 'object') return []
  if (Array.isArray(round.cards)) {
    return round.cards.map(normalizeCardRank).filter(n => Number.isFinite(n))
  }
  if (round.hand && Array.isArray(round.hand.cards)) {
    return round.hand.cards.map(c => normalizeCardRank(c?.rank)).filter(n => Number.isFinite(n))
  }
  if (Array.isArray(round.nums)) {
    return round.nums.map(normalizeCardRank).filter(n => Number.isFinite(n))
  }
  return []
}

function formatRoundCardsText(round){
  try {
    const ranks = extractRoundRanks(round)
    if (!ranks.length) return '-'
    return ranks.map(n => String(Math.trunc(n))).join(',')
  } catch (_) {
    return '-'
  }
}

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
const recentRounds = computed(() => {
  const sorted = filteredRounds.value.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return sorted.slice(0, 12).map(r => ({ ...r, user: userMap.value[r.uid], cardsText: formatRoundCardsText(r) })).reverse()
})

const TREND_BAR_HEIGHT = 160
const TREND_BAR_WIDTH = 24
const TREND_BAR_GAP = 12
const DAY_MS = 86400000

function formatDayKey(ms){
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function shortLabel(key){
  return key ? key.slice(5).replace('-', '/') : ''
}

const trendSeries = computed(() => {
  const rounds = filteredRounds.value
  const byDay = new Map()
  for (const r of rounds) {
    const key = formatDayKey(r.ts || 0)
    const cur = byDay.get(key) || { total: 0, success: 0 }
    cur.total += 1
    if (r.success) cur.success += 1
    byDay.set(key, cur)
  }

  const todayMs = startOfTodayMs()
  const todayKey = formatDayKey(todayMs)
  let keys = []
  if (overviewRange.value > 0) {
    const span = Number(overviewRange.value) || 1
    const startMs = todayMs - (span - 1) * DAY_MS
    for (let ms = startMs; ms <= todayMs; ms += DAY_MS) {
      keys.push(formatDayKey(ms))
    }
  } else {
    keys = Array.from(byDay.keys())
    if (!keys.includes(todayKey)) keys.push(todayKey)
    keys.sort()
    if (keys.length > 30) keys = keys.slice(-30)
  }

  const seriesData = keys.map(key => {
    const entry = byDay.get(key) || { total: 0, success: 0 }
    const total = entry.total || 0
    const success = entry.success || 0
    const winRate = total ? (success / total) : 0
    return { key, total, success, winRate }
  })

  const maxTotal = Math.max(1, ...seriesData.map(item => item.total))

  const items = seriesData.map((item) => {
    const totalHeight = item.total ? Math.max(4, Math.round((item.total / maxTotal) * TREND_BAR_HEIGHT)) : 0
    const successHeight = item.total ? Math.round(totalHeight * item.winRate) : 0
    const failHeight = Math.max(0, totalHeight - successHeight)
    return {
      label: item.key,
      shortLabel: shortLabel(item.key),
      totalHeight,
      successHeight,
      failHeight,
    }
  })

  const width = items.length ? (items.length * (TREND_BAR_WIDTH + TREND_BAR_GAP) - TREND_BAR_GAP) : 0

  return {
    items,
    barWidth: TREND_BAR_WIDTH,
    gap: TREND_BAR_GAP,
    chartHeight: TREND_BAR_HEIGHT,
    width,
  }
})
// 玩家总览：按筛选范围/提示/面牌统计并按胜率排序
const overviewRows = computed(() => computeOverviewRows(rows.value, userExtMap.value, calcCutoffMs()))

const selectedOverviewRow = computed(() => {
  try {
    const id = selectedUserId.value
    if (!id) return null
    const rows = overviewRows.value || []
    return rows.find(r => r.id === id) || null
  } catch (_) {
    return null
  }
})

// ========== 首批 4 项：计算逻辑 ==========
const currentRounds = computed(() => {
  const uid = selectedUserId.value
  const rec = uid ? (userExtMap.value[uid] || { rounds: [] }) : { rounds: [] }
  const cutoff = calcCutoffMs()
  const arr = (rec.rounds || [])
  return cutoff > 0 ? arr.filter(r => (r.ts||0) >= cutoff) : arr.slice()
})

const currentWindowSummary = computed(() => {
  const list = currentRounds.value || []
  const total = list.length
  const success = list.filter(r => r.success).length
  const fail = Math.max(0, total - success)
  const winPct = total ? Math.round((success / total) * 100) : 0
  return { total, success, fail, winPct }
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

// 错误近似度摘要（用于徽章等计算）
const nearSummary = computed(() => summarizeNearMisses(currentRounds.value))

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

const selectedTier = computed(() => {
  const row = selectedOverviewRow.value
  if (row && row.tier) return row.tier
  return resolveRankTier(currentWindowSummary.value.winPct, streakStats.value?.maxWin || 0)
})

const tierAdvancementHint = computed(() => {
  const tier = selectedTier.value
  if (!tier) return { text: '', winDiff: 0, streakDiff: 0, next: null }
  const next = tier.nextTier
  if (!next) return { text: '已达最高段位', winDiff: 0, streakDiff: 0, next: null }
  const winDiff = Math.max(0, (next.minWinRate || 0) - currentWindowSummary.value.winPct)
  const streakDiff = Math.max(0, (next.minStreak || 0) - (streakStats.value?.maxWin || 0))
  let text = ''
  if (winDiff <= 0 && streakDiff <= 0) {
    text = `已满足 ${next.label} 条件，等待统计刷新`
  } else if (winDiff <= 0) {
    text = `再保持 ${streakDiff} 连胜即可解锁 ${next.label}`
  } else if (streakDiff <= 0) {
    text = `胜率再提升 ${winDiff}pt 可晋级 ${next.label}`
  } else {
    text = `距 ${next.label}：胜率 +${winDiff}pt 或 连胜 ${streakDiff} 局`
  }
  return { text, winDiff, streakDiff, next }
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
const dailySeries = computed(() => computeDailySeries(filteredRounds.value))
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

const spark7 = computed(() => computeSparkSeries(dailySeries.value, 7))
const spark30 = computed(() => computeSparkSeries(dailySeries.value, 30))

// ========== 难度热力（Top/Bottom 列表版） ==========
const faceHeat = computed(() => computeFaceHeat(currentRounds.value))

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
const faceSignStats = computed(() => computeFaceSignStats(currentRounds.value))

// 4) 速度-准确散点（用时间分桶概览代替复杂图表）
const speedBuckets = computed(() => {
  const rows = computeSpeedBuckets(currentRounds.value)
  return rows.map(row => {
    const total = row.total || 0
    const success = row.success || 0
    const fail = row.fail || 0
    const avgTimeMs = Number.isFinite(row.avgTimeMs) ? row.avgTimeMs : null
    const successRate = total ? Math.round((success / total) * 100) : 0
    return {
      label: row.label,
      total,
      success,
      fail,
      successRate,
      avgTimeMs,
      avgTimeText: avgTimeMs != null ? fmtMs(avgTimeMs) : '-',
    }
  })
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

const overviewDisplayRows = computed(() => {
  const list = overviewRowsSorted.value || []
  return list.map((row, index) => {
    const tier = row?.tier || resolveRankTier(row?.winRate || 0, row?.maxWin || 0)
    const avgTimeText = Number.isFinite(row?.avgTimeMs) ? fmtMs(row.avgTimeMs) : '-'
    const bestTimeText = Number.isFinite(row?.bestTimeMs) ? fmtMs(row.bestTimeMs) : '-'
    const successPct = Number.isFinite(row?.successPct) ? row.successPct : (row?.total ? Math.round((row.success / row.total) * 100) : 0)
    const failPct = Number.isFinite(row?.failPct) ? row.failPct : Math.max(0, 100 - successPct)
    const rankBadge = index === 0 ? '👑' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : ''))
    return {
      ...row,
      index,
      rankBadge,
      tier,
      avgTimeText,
      bestTimeText,
      successPct,
      failPct,
    }
  })
})

function exitStatsPage() {
  exitApp({
    fallback: () => {
      try {
        if (typeof uni.switchTab === 'function') {
          uni.switchTab({ url: '/pages/index/index' })
          return
        }
      } catch (_) {}
      try {
        if (typeof uni.reLaunch === 'function') {
          uni.reLaunch({ url: '/pages/index/index' })
          return
        }
      } catch (_) {}
    },
  })
}
</script>

<style scoped>
.page{
  min-height:100vh;
  box-sizing:border-box;
  position:relative;
  background:linear-gradient(180deg,#0f172a 0%,#111827 100%);
  color:#e2e8f0;
  padding-bottom:140rpx;
}
.section{
  background:rgba(15,23,42,0.78);
  border-radius:24rpx;
  border:1rpx solid rgba(148,163,184,0.24);
  padding:20rpx 24rpx;
  box-shadow:0 24rpx 48rpx rgba(2,6,23,0.45);
  backdrop-filter:blur(16rpx);
}
.section.title{
  background:transparent;
  border:none;
  box-shadow:none;
  padding:0;
}
.title{
  font-size:34rpx;
  font-weight:800;
  color:#f8fafc;
}
.panel-header{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap:16rpx;
  flex-wrap:wrap;
}
.panel-actions{ display:flex; gap:12rpx; align-items:center; }
.seg{ display:flex; background:rgba(148,163,184,0.18); border-radius:16rpx; overflow:hidden }
.seg-btn{ padding:10rpx 20rpx; color:#e2e8f0; background:transparent; border:none; font-size:26rpx }
.seg-btn.active{ background:rgba(56,189,248,0.18); color:#38bdf8; font-weight:700 }
.overview-table{ margin-top:16rpx }
.table{ margin-top:0 }
.compact-table{ margin-top:0 }
.overview-table .thead,
.overview-table .tr{
  grid-template-columns:140rpx minmax(0,1.5fr) minmax(0,1.5fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.25fr);
}
.overview-table .td.rank{ display:flex; flex-direction:column; align-items:flex-start; gap:6rpx }
.rank-medal{ font-size:34rpx; line-height:1 }
.rank-index{ font-size:24rpx; color:#94a3b8 }
.user-main{ display:flex; align-items:center; gap:16rpx }
.tier-icon{ width:56rpx; height:56rpx; border-radius:18rpx; display:flex; align-items:center; justify-content:center; font-size:32rpx; color:#0f172a; box-shadow:0 12rpx 24rpx rgba(2,6,23,0.45) }
.user-meta{ display:flex; flex-direction:column; gap:4rpx }
.user-name{ font-size:30rpx; font-weight:700; color:#f8fafc }
.user-tier{ font-size:24rpx; color:#94a3b8 }
.stat-value{ font-size:30rpx; font-weight:700; color:#f8fafc }
.stat-sub{ display:block; font-size:22rpx; color:#94a3b8; margin-top:8rpx }
.streak-pill{ display:flex; align-items:center; justify-content:space-between; gap:10rpx; padding:8rpx 14rpx; border-radius:14rpx; background:rgba(56,189,248,0.12) }
.streak-pill.longest{ background:rgba(248,113,113,0.12) }
.pill-label{ font-size:22rpx; color:#94a3b8 }
.pill-value{ font-size:28rpx; font-weight:700; color:#38bdf8 }
.streak-pill.longest .pill-value{ color:#f87171 }
.panel-slot{ margin-top:16rpx; padding:16rpx 20rpx; border-radius:18rpx; border:1rpx solid rgba(148,163,184,0.2); background:rgba(2,6,23,0.35) }
.panel-hint{ margin-top:12rpx; color:#94a3b8; font-size:24rpx }
.trend-chips{ display:flex; gap:12rpx; align-items:center; flex-wrap:wrap }
.stat-chip{ min-width:160rpx; padding:10rpx 16rpx; border-radius:16rpx; background:rgba(2,6,23,0.45); border:1rpx solid rgba(148,163,184,0.24); display:flex; flex-direction:column; gap:4rpx }
.chip-label{ font-size:22rpx; color:#94a3b8; letter-spacing:2rpx }
.chip-value{ font-size:30rpx; font-weight:700; display:flex; align-items:center; gap:8rpx; color:#f8fafc }
.trend-summary .stacked-bar{ box-shadow:inset 0 4rpx 8rpx rgba(2,6,23,0.25) }
.trend-meta{ margin-top:12rpx; display:flex; gap:12rpx; flex-wrap:wrap }
.meta{ font-size:24rpx; color:#e2e8f0 }
.meta.muted{ color:#94a3b8 }
.trend-chart{ width:100%; overflow-x:auto }
.trend-chart-inner{ position:relative }
.trend-bars{ display:flex; align-items:flex-end; height:100% }
.trend-item{ display:flex; justify-content:center; align-items:flex-end; height:100% }
.trend-item .bar{ width:100%; display:flex; flex-direction:column; justify-content:flex-end; border-radius:14rpx 14rpx 0 0; overflow:hidden; background:rgba(148,163,184,0.24) }
.trend-item .bar-fail{ width:100%; background:rgba(248,113,113,0.55) }
.trend-item .bar-success{ width:100%; background:linear-gradient(180deg,#4ade80,#15803d) }
.trend-labels{ display:flex; justify-content:flex-start; margin-top:6rpx }
.trend-labels .bar-label{ text-align:center; color:#94a3b8; font-size:22rpx; white-space:nowrap }
.trend-labels.rotate{ min-height:60rpx; align-items:flex-end }
.trend-labels.rotate .bar-label{ transform:rotate(-90deg); transform-origin:center center }
.rank-progress{ display:flex; flex-direction:column; gap:12rpx }
.rank-progress-bar{ height:20rpx }
.rank-progress-meta{ display:flex; gap:12rpx; flex-wrap:wrap }
.streak-table .thead,
.streak-table .tr{ grid-template-columns:repeat(4,minmax(0,1fr)) }
.rounds{ margin-top:16rpx; display:flex; flex-direction:column; gap:12rpx }
.round-item{ display:grid; grid-template-columns:200rpx 120rpx 160rpx 1fr; gap:12rpx; padding:12rpx 16rpx; border-radius:16rpx; background:rgba(2,6,23,0.45); border:1rpx solid rgba(148,163,184,0.2) }
.r-time, .r-result, .r-timeMs{ font-size:26rpx; font-weight:600; color:#f8fafc }
.r-cards{ font-size:26rpx; font-weight:600; color:#cbd5f5; font-family:'SFMono-Regular','Menlo','Monaco','Consolas','Liberation Mono','Courier New',monospace }
.r-result.ok{ color:#34d399 }
.r-result.fail{ color:#f87171 }
.picker-trigger{ padding:8rpx 14rpx; background:rgba(148,163,184,0.16); border-radius:12rpx; color:#e2e8f0 }
.mistake-summary{ display:flex; flex-wrap:wrap; gap:16rpx; align-items:stretch }
.mistake-summary-item{ flex:1 1 200rpx; padding:16rpx 20rpx; border-radius:16rpx; background:rgba(56,189,248,0.08); border:1rpx solid rgba(148,163,184,0.2); display:flex; flex-direction:column; gap:6rpx }
.mistake-summary-item.active{ background:rgba(248,113,113,0.12) }
.mistake-summary-label{ font-size:24rpx; color:#94a3b8 }
.mistake-summary-value{ font-size:36rpx; font-weight:800; color:#f8fafc }
.mistake-progress{ flex-basis:100%; display:flex; flex-direction:column; gap:8rpx }
.mistake-progress-meta{ display:flex; gap:12rpx; flex-wrap:wrap }
.mistake-controls{ display:flex; align-items:center; justify-content:space-between; gap:16rpx; flex-wrap:wrap }
.mistake-filter{ display:flex; align-items:center; gap:12rpx; color:#e2e8f0; font-size:26rpx }
.mistake-sort{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12rpx; flex:1; min-width:360rpx }
.mistake-table .thead,
.mistake-table .tr{ grid-template-columns:220rpx 120rpx 120rpx 120rpx 120rpx 120rpx 120rpx 200rpx }
.mistake-table .td:first-child{ text-align:left }
.mistake-tip{ color:#94a3b8; font-size:24rpx; flex:1; text-align:right }
.empty-hint{ margin-top:16rpx; font-size:26rpx }
.difficulty-heatmaps{ display:grid; grid-template-rows:auto auto; row-gap:12rpx; margin-top:8rpx; width:100% }
@media screen and (min-width:960px){ .difficulty-heatmaps{ max-width:960rpx; margin-left:auto; margin-right:auto } }
.floating-hint-layer{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:999 }
.floating-hint-layer.interactive{ pointer-events:auto }
.floating-hint{ max-width:70%; background:rgba(15,23,42,0.86); color:#fff; padding:24rpx 36rpx; border-radius:24rpx; text-align:center; font-size:30rpx; box-shadow:0 20rpx 48rpx rgba(15,23,42,0.25); backdrop-filter:blur(12px) }
</style>
