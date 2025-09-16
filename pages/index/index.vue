<template>
  <view class="page col" :class="{ booted }" style="padding: 24rpx; gap: 16rpx; position: relative;"
        @touchstart="swipeStart" @touchmove="swipeMove" @touchend="swipeEnd">

    <!-- 顶部：当前用户与切换 -->
    <view class="topbar" style="display:flex; align-items:center; justify-content:space-between; gap:12rpx; background:transparent; border:none;">
      <text class="topbar-title" style="text-align:left; flex:1;">当前用户：{{ currentUser && currentUser.name ? currentUser.name : '未选择' }}</text>
      <button class="btn btn-secondary" style="padding:16rpx 20rpx; width:auto;" @click="goLogin">切换用户</button>
    </view>

    <!-- 本局统计：紧凑表格（1行表头 + 1行数据） -->
      <view id="statsRow" class="card section stats-compact-table stats-card">
        <view class="thead">
        <text class="th">剩余</text>
        <text class="th">局数</text>
        <text class="th ok">成功</text>
        <text class="th fail">失败</text>
        <text class="th">胜率</text>
        <text class="th">上一局</text>
        <text class="th">本局</text>
        </view>
      <view class="tbody">
        <text class="td">{{ remainingCards }}</text>
        <text class="td">{{ handsPlayed }}</text>
        <text class="td ok">{{ successCount }}</text>
        <text class="td fail">{{ failCount }}</text>
        <text class="td">{{ winRate }}%</text>
        <text class="td">{{ lastSuccessMs != null ? fmtMs(lastSuccessMs) : '-' }}</text>
        <view class="td">
          <block v-if="handElapsedMs < 120000">
            <text>{{ fmtMs1(handElapsedMs) }}</text>
          </block>
          <block v-else>
            <button class="btn btn-secondary btn-reshuffle" @click="reshuffle">洗牌</button>
          </block>
        </view>
      </view>
    </view>

    <!-- 牌区：四张卡片等宽占满一行（每张卡片单独计数） -->
    <view id="cardGrid" class="card-grid" style="padding-top: 0rpx;">
      <view v-for="(card, idx) in cards" :key="idx"
            class="playing-card"
            :class="{ used: (usedByCard[idx]||0) > 0 }"
            @touchstart.stop.prevent="startDrag({ type: 'num', value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event)"
            @touchmove.stop.prevent="onDrag($event)"
            @touchend.stop.prevent="endDrag()">
        <image class="card-img" :src="cardImage(card)" mode="widthFix"/>
      </view>
    </view>

    <!-- 运算符候选区：两行布局 -->
    <view id="opsRow1" :class="['ops-row-1', opsDensityClass]">
      <button v-for="op in ['+','-','×','÷']" :key="op" class="btn btn-operator"
              @touchstart.stop.prevent="startDrag({ type: 'op', value: op }, $event)"
              @touchmove.stop.prevent="onDrag($event)"
              @touchend.stop.prevent="endDrag()">{{ op }}</button>
    </view>
    <view id="opsRow2" :class="['ops-row-2', opsDensityClass]">
      <view class="ops-left">
        <button v-for="op in ['(',')']" :key="op" class="btn btn-operator"
                @touchstart.stop.prevent="startDrag({ type: 'op', value: op }, $event)"
                @touchmove.stop.prevent="onDrag($event)"
                @touchend.stop.prevent="endDrag()">{{ op }}</button>
      </view>
      <button class="btn btn-secondary mode-btn" @click="toggleFaceMode">{{ faceUseHigh ? 'J/Q/K=11/12/13' : 'J/Q/K=1' }}</button>
    </view>

    <!-- 拖拽中的浮层 -->
    <view v-if="drag.active" class="drag-ghost" :style="ghostStyle">{{ ghostText }}</view>

    <!-- 表达式卡片容器（高度由脚本计算） -->
    <view class="expr-card card section">
      <!-- <view class="expr-title">当前表达式：<text class="status-text">{{ currentText ? currentText : '未完成' }}</text></view> -->
      <view id="exprZone" class="expr-zone" :class="{ 'expr-zone-active': drag.active }" :style="{ height: exprZoneHeight + 'px' }">
        <!-- <view v-if="tokens.length === 0" class="expr-placeholder">将卡牌和运算符拖到这里</view> -->
        <view id="exprRow" class="row expr-row" :style="{ transform: 'scale(' + exprScale + ')', transformOrigin: 'left center' }">
          <block v-for="(t, i) in tokens" :key="i">
            <view v-if="dragInsertIndex === i" class="insert-placeholder" :class="placeholderSizeClass"></view>
            <view class="tok" :class="[ (t.type === 'num' ? 'num' : 'op'), { 'just-inserted': i === lastInsertedIndex, 'dragging': drag.token && drag.token.type==='tok' && drag.token.index===i } ]"
                  @touchstart.stop.prevent="startDrag({ type: 'tok', index: i, value: t.value }, $event)"
                  @touchmove.stop.prevent="onDrag($event)"
                  @touchend.stop.prevent="endDrag()">
              <image v-if="t.type==='num'" class="tok-card-img" :src="cardImage({ rank: t.rank || +t.value, suit: t.suit || 'S' })" mode="heightFix"/>
              <text v-else class="tok-op-text">{{ t.value }}</text>
            </view>
          </block>
          <view v-if="dragInsertIndex === tokens.length" class="insert-placeholder" :class="placeholderSizeClass"></view>
        </view>
      </view>
    </view>

    <!-- 轻提示文案 -->
    <text id="hintText" class="hint-text" :class="{ error: feedbackIsError }">{{ feedback || '请用四张牌和运算符算出 24' }}</text>

    <!-- 提交：占满一行宽度 -->
    <view id="submitRow">
      <button class="btn btn-primary" style="width:100%" @click="check">提交答案</button>
    </view>

    <!-- 提示 / 换题：位于提交区下方 -->
    <view id="failRow" class="pair-grid">
      <button class="btn btn-secondary" @click="showSolution">提示</button>
      <button class="btn btn-secondary" @click="skipHand">下一题</button>
    </view>

    <!-- 底部导航由全局 tabBar 提供（见 pages.json） -->
    <!-- 成功动画覆盖层（0.5s） -->
    <view v-if="successAnimating" class="success-overlay">
      <view class="success-burst">24!</view>
    </view>
    <view v-if="errorAnimating" class="success-overlay">
      <view class="error-burst">
        <text class="err-title">计算错误</text>
        <text v-if="errorValueText" class="err-val">{{ errorValueText }}</text>
      </view>
    </view>
  </view>
  <CustomTabBar />
</template>

<script setup>
import { ref, onMounted, onUnmounted, getCurrentInstance, computed, watch, nextTick } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import CustomTabBar from '../../components/CustomTabBar.vue'
import { evaluateExprToFraction, solve24 } from '../../utils/solver.js'
import { ensureInit, getCurrentUser, getUsers, pushRound, readStatsExtended } from '../../utils/store.js'

const cards = ref([{ rank:1, suit:'S' }, { rank:5, suit:'H' }, { rank:5, suit:'D' }, { rank:5, suit:'C' }])
const solution = ref(null)
const feedback = ref('')
const usedByCard = ref([0,0,0,0])
const tokens = ref([])
const faceUseHigh = ref(false)
const handRecorded = ref(false)
const exprZoneHeight = ref(200)
const currentUser = ref(null)
const deck = ref([])
const handsPlayed = ref(0)
const successCount = ref(0)
const failCount = ref(0)
const sessionOver = ref(false)
const successAnimating = ref(false)
const errorAnimating = ref(false)
const feedbackIsError = ref(false)
const errorValueText = ref('')
const handStartTs = ref(Date.now())
const nowTs = ref(Date.now())
const hintWasUsed = ref(false)
const attemptCount = ref(0)
const lastSuccessMs = ref(null)
const SESSION_KEY = 'tf24_game_session_v1'

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
  // 水平主导且超过阈值时触发，避免与竖向滚动冲突
  if (absX > 60 && absX > absY * 1.5) {
    if (dx < 0) {
      navigateTab('/pages/user/index')
    } else {
      navigateTab('/pages/stats/index')
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

function saveSession() {
  try {
    const data = {
      deck: deck.value || [],
      cards: cards.value || [],
      tokens: (tokens.value || []).map(t => ({ type: t.type, value: t.value, rank: t.rank, suit: t.suit })),
      usedByCard: usedByCard.value || [],
      faceUseHigh: !!faceUseHigh.value,
      handRecorded: !!handRecorded.value,
      handStartTs: handStartTs.value || 0,
      hintWasUsed: !!hintWasUsed.value,
      attemptCount: attemptCount.value || 0,
      handsPlayed: handsPlayed.value || 0,
      successCount: successCount.value || 0,
      failCount: failCount.value || 0,
      feedback: feedback.value || '',
    }
    uni.setStorageSync(SESSION_KEY, JSON.stringify(data))
  } catch (_) { /* noop */ }
}

function loadSession() {
  try {
    const raw = uni.getStorageSync(SESSION_KEY)
    if (!raw) return false
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || !Array.isArray(data.deck) || !Array.isArray(data.cards)) return false
    if ((data.cards || []).length === 4) {
      deck.value = data.deck
      cards.value = data.cards
      tokens.value = Array.isArray(data.tokens) ? data.tokens : []
      usedByCard.value = Array.isArray(data.usedByCard) ? data.usedByCard : [0,0,0,0]
      faceUseHigh.value = !!data.faceUseHigh
      handRecorded.value = !!data.handRecorded
      handStartTs.value = data.handStartTs || Date.now()
      hintWasUsed.value = !!data.hintWasUsed
      attemptCount.value = data.attemptCount || 0
      handsPlayed.value = data.handsPlayed || 0
      successCount.value = data.successCount || 0
      failCount.value = data.failCount || 0
      feedback.value = data.feedback || ''
      nextTick(() => { updateVHVar(); updateExprScale(); recomputeExprHeight() })
      return true
    }
    return false
  } catch (_) { return false }
}

const remainingCards = computed(() => (deck.value || []).length)
const winRate = computed(() => {
  const t = successCount.value + failCount.value
  return t ? Math.round(100 * successCount.value / t) : 0
})
const handElapsedMs = computed(() => {
  const start = handStartTs.value || Date.now()
  const now = nowTs.value || Date.now()
  const d = now - start
  return d > 0 ? d : 0
})

let handTimer = null
function startHandTimer() {
  if (handTimer) return
  try { handTimer = setInterval(() => { nowTs.value = Date.now() }, 100) } catch (_) { handTimer = null }
}
function stopHandTimer() { if (handTimer) { try { clearInterval(handTimer) } catch(_){} handTimer = null } }

const drag = ref({ active: false, token: null, x: 0, y: 0, startX: 0, startY: 0, moved: false })
const exprBox = ref({ left: 0, top: 0, right: 0, bottom: 0 })
const tokRects = ref([])
const dragInsertIndex = ref(-1)
const lastInsertedIndex = ref(-1)
const { proxy } = getCurrentInstance()

const booted = ref(false)

const expr = computed(() => tokens.value.map(x => x.type==='num' ? String(evalRank(x.rank ?? +x.value)) : x.value).join(''))
const ghostStyle = computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`)
const exprScale = ref(1)
const opsDensity = ref('normal') // normal | compact | tight
const opsDensityClass = computed(() => opsDensity.value === 'tight' ? 'ops-tight' : (opsDensity.value === 'compact' ? 'ops-compact' : ''))
const ghostText = computed(() => {
  const t = drag.value.token
  if (!t) return ''
  if (t.type === 'num') return labelFor(t.rank || +t.value)
  if (t.type === 'tok') return /^(10|11|12|13|[1-9])$/.test(t.value) ? labelFor(+t.value) : t.value
  return t.value || ''
})
const placeholderSizeClass = computed(() => {
  const dt = drag.value.token
  if (!drag.value.active || !dt) return 'op'
  if (dt.type === 'num') return 'num'
  if (dt.type === 'op') return 'op'
  if (dt.type === 'tok') return (/^(10|11|12|13|[1-9])$/).test(dt.value) ? 'num' : 'op'
  return 'op'
})

const currentText = computed(() => {
  attemptCount.value += 1
  const s = expr.value
  if (!s) return ''
  const v = evaluateExprToFraction(s)
  return v ? `${v.toString()}` : ''
})

function refresh() { nextHand() }

function initDeck() {
  const suits = ['S','H','D','C']
  const arr = []
  for (const s of suits) { for (let r=1; r<=13; r++) arr.push({ rank:r, suit:s }) }
  // shuffle
  for (let i=arr.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] }
  deck.value = arr
}

  function nextHand() {
    if (!deck.value || deck.value.length < 4) {
      // 整副用尽：提示是否重洗，不计入“本局结束”与统计
      try {
        uni.showModal({
          title: '牌库用尽',
          content: '余牌无解或整副用完，是否重新洗牌？',
          confirmText: '重洗',
          cancelText: '进入统计',
          success: (res) => {
            if (res.confirm) {
              initDeck()
              // 新一副牌开始：本副内统计清零
              handsPlayed.value = 0
              successCount.value = 0
              failCount.value = 0
              nextTick(() => nextHand())
            } else {
              try { uni.reLaunch({ url: '/pages/stats/index' }) }
              catch (e1) { try { uni.navigateTo({ url: '/pages/stats/index' }) } catch (_) {} }
            }
          }
        })
      } catch (_) {
        // 回退策略：直接重洗继续（同时清零本副内统计）
        initDeck()
        handsPlayed.value = 0
        successCount.value = 0
        failCount.value = 0
        nextTick(() => nextHand())
      }
      return
    }
  const maxTry = Math.min(200, 1 + (deck.value.length * deck.value.length))
  let pickIdx = null
  for (let t=0; t<maxTry; t++) {
    const idxs = new Set()
    while (idxs.size < 4) idxs.add(Math.floor(Math.random() * deck.value.length))
    const ids = Array.from(idxs)
    const cs = ids.map(i => deck.value[i])
    const mapped = cs.map(c => evalRank(c.rank))
    const sol = solve24(mapped)
    if (sol) { pickIdx = { ids, sol }; break }
  }
    if (!pickIdx) {
      // 无可解手牌：按“用尽重洗”流程处理，不判定为本局结束
      try {
        uni.showModal({
          title: '牌库用尽',
          content: '余牌无解或整副用完，是否重新洗牌？',
          confirmText: '重洗',
          cancelText: '进入统计',
          success: (res) => {
            if (res.confirm) {
              initDeck()
              // 新一副牌开始：本副内统计清零
              handsPlayed.value = 0
              successCount.value = 0
              failCount.value = 0
              nextTick(() => nextHand())
            } else {
              try { uni.reLaunch({ url: '/pages/stats/index' }) }
              catch (e1) { try { uni.navigateTo({ url: '/pages/stats/index' }) } catch (_) {} }
            }
          }
        })
      } catch (_) {
        initDeck()
        handsPlayed.value = 0
        successCount.value = 0
        failCount.value = 0
        nextTick(() => nextHand())
      }
      return
    }
  const ids = pickIdx.ids.sort((a,b)=>b-a)
  const cs = []
  for (const i of ids) { cs.unshift(deck.value[i]); deck.value.splice(i,1) }
  cards.value = cs
  solution.value = pickIdx.sol
  tokens.value = []
  usedByCard.value = [0,0,0,0]
  handRecorded.value = false
  handStartTs.value = Date.now()
  hintWasUsed.value = false
  attemptCount.value = 0
  feedback.value = '拖入 + - × ÷ ( ) 组成 24'
  nextTick(() => recomputeExprHeight())
  try { saveSession() } catch(_) {}
}

onMounted(() => {
  ensureInit()
  try { uni.hideTabBar && uni.hideTabBar() } catch (_) {}
  try {
    const u = getUsers && getUsers()
    const list = (u && Array.isArray(u.list)) ? u.list : []
    if (list.length==0) {
      try {
        uni.showModal({
          title: '暂无用户',
          content: '请先新建用户后再开始程序。',
          confirmText: '去新建',
          showCancel: false,
          success: () => {
            try { uni.reLaunch({ url: '/pages/login/index' }) }
            catch (e1) { try { uni.navigateTo({ url: '/pages/login/index' }) } catch (_) {} }
          }
        })
      } catch (_) {
        try { uni.reLaunch({ url: '/pages/login/index' }) }
        catch (e1) { try { uni.navigateTo({ url: '/pages/login/index' }) } catch (_) {} }
      }
      return
    }
  } catch (_) { /* noop */ }

  currentUser.value = getCurrentUser() || null
  const restored = loadSession()
  if (!restored) { initDeck(); nextHand() }
  setTimeout(() => { booted.value = true }, 0)
  nextTick(() => { updateVHVar(); recomputeExprHeight(); updateExprScale() })
  if (uni.onWindowResize) uni.onWindowResize(() => { updateVHVar(); updateExprScale(); recomputeExprHeight() })
  updateLastSuccess()
  startHandTimer()
})

onShow(() => { loadSession(); startHandTimer() })
onHide(() => { saveSession(); stopHandTimer() })
onUnmounted(() => { stopHandTimer() })

// 已移除“清空表达式”功能，避免误触清空

function computeExprStats() {
  const arr = tokens.value || []
  const ops = []
  let depth = 0, maxDepth = 0
  for (const t of arr) {
    if (t.type === 'op') {
      if (t.value === '(') { depth++; if (depth > maxDepth) maxDepth = depth; continue }
      if (t.value === ')') { depth = Math.max(0, depth - 1); continue }
      if (t.value === '+' || t.value === '-' || t.value === '×' || t.value === '÷') ops.push(t.value)
    }
  }
  return { exprLen: arr.length, maxDepth, ops }
}

function updateLastSuccess() {
  try {
    const cu = getCurrentUser && getCurrentUser()
    if (!cu || !cu.id) { lastSuccessMs.value = null; return }
    const ext = readStatsExtended && readStatsExtended(cu.id)
    const r = (ext && Array.isArray(ext.rounds) ? ext.rounds.slice().reverse() : []).find(x => x && x.success && Number.isFinite(x.timeMs))
    lastSuccessMs.value = r ? r.timeMs : null
  } catch (_) { lastSuccessMs.value = null }
}

function fmtMs(ms){ if (!Number.isFinite(ms)) return '-'; if (ms < 1000) return ms + 'ms'; const s = ms/1000; if (s<60) return s.toFixed(1)+'s'; const m = Math.floor(s/60); const r = Math.round(s%60); return `${m}m${r}s` }
function fmtMs1(ms){ if (!Number.isFinite(ms)) return '-'; const s = ms/1000; if (s < 120) return s.toFixed(1)+'s'; return fmtMs(ms) }

function isExprComplete() {
  const arr = tokens.value || []
  if (!arr.length) return false
  let bal = 0
  let prev = null
  const isBin = v => (v==='+'||v==='-'||v==='×'||v==='÷')
  for (const t of arr) {
    if (t.type === 'op' && t.value === '(') bal++
    else if (t.type === 'op' && t.value === ')') { bal--; if (bal < 0) return false }
    if (!prev) {
      if (t.type==='op' && (t.value===')' || isBin(t.value))) return false
    } else {
      const pa = prev.type === 'op' ? prev.value : 'num'
      const pb = t.type === 'op' ? t.value : 'num'
      if (isBin(pa) && isBin(pb)) return false
    }
    prev = t
  }
  const last = arr[arr.length-1]
  if (last && last.type==='op' && (last.value==='(' || isBin(last.value))) return false
  return bal === 0
}

function check() {
  const usedCount = usedByCard.value.reduce((a,b)=>a+(b?1:0),0)
  errorValueText.value = ''
  if (usedCount !== 4) { feedback.value = '请先用完四张牌再提交'; feedbackIsError.value = true; return }
  if (!isExprComplete()) { feedback.value = '表达式错误'; feedbackIsError.value = true; return }
  const s = expr.value
  const v = evaluateExprToFraction(s)
  const ok = (v && v.equalsInt && v.equalsInt(24))
  feedback.value = ok ? '恭喜，得到 24！' : '计算错误'
  feedbackIsError.value = !ok
  // 统计记录移至首次结算时写入（避免重复记账）
  if (ok && !handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    successCount.value += 1
    try {
      const stats = computeExprStats()
      pushRound({
        success: true,
        timeMs: Date.now() - (handStartTs.value || Date.now()),
        hintUsed: !!hintWasUsed.value,
        retries: Math.max(0, (attemptCount.value || 1) - 1),
        ops: stats.ops,
        exprLen: stats.exprLen,
        maxDepth: stats.maxDepth,
        faceUseHigh: !!faceUseHigh.value,
        hand: { cards: (cards.value || []).map(c => ({ rank: c.rank, suit: c.suit })) },
        expr: s,
      })
      updateLastSuccess()
    } catch (_) {}
    // 成功动画并自动下一题（0.5s）
    try {
      successAnimating.value = true
      setTimeout(() => { successAnimating.value = false; nextHand() }, 500)
    } catch (_) { nextHand() }
  } else if (!ok) {
    try {
      if (v && typeof v.toString === 'function') {
        errorValueText.value = '结果：' + v.toString()
      }
    } catch (_) { errorValueText.value = '' }
    // 计为失败但不换题；允许继续尝试成功
    try {
      const stats = computeExprStats()
      failCount.value += 1
      pushRound({
        success: false,
        timeMs: Date.now() - (handStartTs.value || Date.now()),
        hintUsed: !!hintWasUsed.value,
        retries: attemptCount.value || 0,
        ops: stats.ops,
        exprLen: stats.exprLen,
        maxDepth: stats.maxDepth,
        faceUseHigh: !!faceUseHigh.value,
        hand: { cards: (cards.value || []).map(c => ({ rank: c.rank, suit: c.suit })) },
        expr: s,
      })
    } catch (_) { /* noop */ }
    try {
      errorAnimating.value = true
      setTimeout(() => { errorAnimating.value = false }, 500)
    } catch (_) {}
  }
  try { saveSession() } catch(_) {}
}

function showSolution() {
  hintWasUsed.value = true
  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try {
      const stats = computeExprStats()
      pushRound({
        success: false,
        timeMs: Date.now() - (handStartTs.value || Date.now()),
        hintUsed: true,
        retries: attemptCount.value || 0,
        ops: stats.ops,
        exprLen: stats.exprLen,
        maxDepth: stats.maxDepth,
        faceUseHigh: !!faceUseHigh.value,
        hand: { cards: (cards.value || []).map(c => ({ rank: c.rank, suit: c.suit })) },
        expr: expr.value,
      })
      updateLastSuccess()
    } catch (_) {}
  }
  feedback.value = solution.value ? ('答案：' + solution.value) : '暂无提示'
}

function toggleFaceMode() { faceUseHigh.value = !faceUseHigh.value }

function skipHand() {
  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try {
      const stats = computeExprStats()
      pushRound({
        success: false,
        timeMs: Date.now() - (handStartTs.value || Date.now()),
        hintUsed: !!hintWasUsed.value,
        retries: attemptCount.value || 0,
        ops: stats.ops,
        exprLen: stats.exprLen,
        maxDepth: stats.maxDepth,
        faceUseHigh: !!faceUseHigh.value,
        hand: { cards: (cards.value || []).map(c => ({ rank: c.rank, suit: c.suit })) },
        expr: expr.value,
      })
      updateLastSuccess()
    } catch (_) {}
  }
  nextHand()
}

function reshuffle() {
  // 主动重洗：不计失败，清零本副统计并开始新副牌
  initDeck()
  handsPlayed.value = 0
  successCount.value = 0
  failCount.value = 0
  handRecorded.value = false
  feedback.value = ''
  nextTick(() => { nextHand(); saveSession() })
}

function goLogin(){ try { uni.reLaunch({ url:'/pages/login/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/login/index' }) } catch(_){} } }
function goStats(){ try { uni.reLaunch({ url:'/pages/stats/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/stats/index' }) } catch(_){} } }
function goGame(){ try { uni.reLaunch({ url:'/pages/index/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/index/index' }) } catch(_){} } }
function goUser(){ try { uni.reLaunch({ url:'/pages/user/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/user/index' }) } catch(_){} } }

function startDrag(token, e) {
  drag.value.active = true
  drag.value.token = token
  const p = pointFromEvent(e)
  drag.value.x = p.x
  drag.value.y = p.y
  drag.value.startX = p.x
  drag.value.startY = p.y
  drag.value.moved = false
  measureDropZones()
}
function onDrag(e) {
  if (!drag.value.active) return
  const p = pointFromEvent(e)
  drag.value.x = p.x
  drag.value.y = p.y
  const dx = drag.value.x - drag.value.startX
  const dy = drag.value.y - drag.value.startY
  if (!drag.value.moved && (dx*dx + dy*dy) > 16) drag.value.moved = true
  const token = drag.value.token
  if (token && token.type === 'tok') {
    const x = drag.value.x, y = drag.value.y
    const inExpr = inside(exprBox.value, x, y)
    if (inExpr) {
      const to = calcInsertIndex(x, y)
      if (to !== token.index && to !== token.index + 1) {
        moveToken(token.index, to)
        token.index = to > token.index ? to - 1 : to
        measureDropZones()
      }
      dragInsertIndex.value = to
    } else {
      dragInsertIndex.value = -1
    }
  } else {
    const x = drag.value.x, y = drag.value.y
    const inExpr = inside(exprBox.value, x, y)
    dragInsertIndex.value = inExpr ? calcInsertIndex(x, y) : -1
  }
}
function endDrag() {
  if (!drag.value.active) return
  const x = drag.value.x, y = drag.value.y
  const token = drag.value.token
  const inExpr = inside(exprBox.value, x, y)
  // 单击快捷操作：未发生拖动时立即处理
  if (token && !drag.value.moved) {
    if (token.type === 'tok') {
      removeTokenAt(token.index)
    } else if (token.type === 'num' || token.type === 'op') {
      tryAppendToken(token)
      lastInsertedIndex.value = Math.max(0, tokens.value.length - 1)
      setTimeout(() => { lastInsertedIndex.value = -1 }, 220)
    }
    drag.value.active = false
    drag.value.token = null
    dragInsertIndex.value = -1
    return
  }
  if (token && token.type === 'tok') {
    if (inExpr) {
      const to = calcInsertIndex(x, y)
      moveToken(token.index, to)
      lastInsertedIndex.value = Math.max(0, Math.min(to, tokens.value.length - 1))
      setTimeout(() => { lastInsertedIndex.value = -1 }, 220)
    } else {
      removeTokenAt(token.index)
    }
  } else if (inExpr && token) {
    const to = calcInsertIndex(x, y)
    tryInsertTokenAt(token, to)
    lastInsertedIndex.value = Math.max(0, Math.min(to, tokens.value.length - 1))
    setTimeout(() => { lastInsertedIndex.value = -1 }, 220)
  }
  drag.value.active = false
  drag.value.token = null
  dragInsertIndex.value = -1
}

function tryAppendToken(token) { tryInsertTokenAt(token, tokens.value.length) }

function tryInsertTokenAt(token, to) {
  const clamped = Math.max(0, Math.min(to, tokens.value.length))
  if (token.type === 'num') {
    const ci = token.cardIndex
    if (ci == null) { feedback.value = '请选择一张牌'; return }
    if ((usedByCard.value[ci] || 0) >= 1) { feedback.value = '该牌已使用'; return }
    const arr = tokens.value.slice()
    arr.splice(clamped, 0, { type: 'num', value: token.value, rank: token.rank, suit: token.suit, cardIndex: ci })
    tokens.value = arr
    const u = usedByCard.value.slice(); u[ci] = 1; usedByCard.value = u
  } else if (token.type === 'op') {
    const arr = tokens.value.slice()
    arr.splice(clamped, 0, { type: 'op', value: token.value })
    tokens.value = arr
  }
}

function removeTokenAt(i) {
  if (i < 0 || i >= tokens.value.length) return
  const t = tokens.value[i]
  if (t && t.type === 'num' && t.cardIndex != null) {
    const u = usedByCard.value.slice(); u[t.cardIndex] = 0; usedByCard.value = u
  }
  tokens.value = tokens.value.slice(0, i).concat(tokens.value.slice(i + 1))
}

function measureDropZones() {
  const q = uni.createSelectorQuery().in(proxy)
  q.select('#exprZone').boundingClientRect()
   .selectAll('.tok').boundingClientRect()
   .exec(res => {
     const [exprRect, tokRectList] = res || []
     if (exprRect) exprBox.value = { left: exprRect.left, top: exprRect.top, right: exprRect.right, bottom: exprRect.bottom }
     tokRects.value = tokRectList || []
   })
}

function inside(box, x, y) { return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom }
function pointFromEvent(e) {
  const t = (e && e.touches && e.touches[0]) || (e && e.changedTouches && e.changedTouches[0]) || (e && e.detail) || { x: 0, y: 0 }
  return { x: t.clientX ?? t.x ?? 0, y: t.clientY ?? t.y ?? 0 }
}

function updateExprScale() {
  exprScale.value = 1
  nextTick(() => {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#exprZone').boundingClientRect()
     .select('#exprRow').boundingClientRect()
     .exec(res => {
       const [zone, row] = res || []
       if (!zone || !row) return
       const avail = zone.width - 24
       const need = row.width || 0
       if (avail > 0 && need > 0) {
         const s = Math.min(1, avail / need)
         exprScale.value = (isFinite(s) && s > 0) ? s : 1
       } else {
         exprScale.value = 1
       }
     })
  })
}

watch(tokens, () => updateExprScale())

function calcInsertIndex(x, y) {
  const rects = tokRects.value || []
  if (!rects.length) return tokens.value.length
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = cx - x
    const dy = cy - y
    const d = dx*dx + dy*dy
    if (d < bestDist) { bestDist = d; best = i }
  }
  const r = rects[best]
  const cx = r.left + r.width / 2
  return x < cx ? best : best + 1
}

function moveToken(from, to) {
  if (from === to) return
  const arr = tokens.value.slice()
  const t = arr.splice(from, 1)[0]
  const clamped = Math.max(0, Math.min(to, arr.length))
  arr.splice(clamped, 0, t)
  tokens.value = arr
}

function updateVHVar() {
  try {
    const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
    const h = sys.windowHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
    if (h) document.documentElement && document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px')
  } catch (e) { /* noop */ }
}

// 表达式区域高度：页面高度扣除（提示、运算符两行、提交/清空、提示/换题）后的剩余；至少 120
function recomputeExprHeight() {
  const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
  const winH = sys.windowHeight || sys.screenHeight || 0
  if (winH && winH < 640) opsDensity.value = 'tight'
  else if (winH && winH < 740) opsDensity.value = 'compact'
  else opsDensity.value = 'normal'
  nextTick(() => {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#exprZone').boundingClientRect()
     .select('#hintText').boundingClientRect()
     .select('#opsRow1').boundingClientRect()
     .select('#opsRow2').boundingClientRect()
     .select('#submitRow').boundingClientRect()
     .select('#failRow').boundingClientRect()
     .exec(res => {
       const [exprRect, hintRect, ops1Rect, ops2Rect, submitRect, failRect] = res || []
       if (!exprRect) return
       const hHint = (hintRect && hintRect.height) || 0
       const hOps1 = (ops1Rect && ops1Rect.height) || 0
       const hOps2 = (ops2Rect && ops2Rect.height) || 0
       const hSubmit = (submitRect && submitRect.height) || 0
       const hFail = (failRect && failRect.height) || 0
       // 閫傚綋鐣欑櫧 12px
       let avail = winH - (exprRect.top || 0) - (hHint + hOps1 + hOps2 + hSubmit + hFail) - 12
       if (!isFinite(avail) || avail <= 0) avail = 120
      //  exprZoneHeight.value = Math.max(120, Math.floor(avail))
       exprZoneHeight.value = 70
     })
  })
}

function evalRank(rank) {
  if (rank === 1) return 1
  if (rank === 11 || rank === 12 || rank === 13) return faceUseHigh.value ? rank : 1
  return rank
}
function labelFor(n) {
  if (n === 1) return 'A'
  if (n === 11) return 'J'
  if (n === 12) return 'Q'
  if (n === 13) return 'K'
  return String(n)
}
function cardImage(card) {
  const suitMap = { 'S': 'Spade', 'H': 'Heart', 'D': 'Diamond', 'C': 'Club' }
  const faceMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
  const suitName = suitMap[card.suit] || 'Spade'
  const rankName = faceMap[card.rank] || String(card.rank)
  return `/static/cards/${suitName}${rankName}.png`
}
function randomSuit() { return ['S','H','D','C'][Math.floor(Math.random()*4)] }

function onSessionOver() {
  try {
    uni.showModal({
      title: '本局结束',
      content: `局数：${handsPlayed.value}\n成功：${successCount.value}\n胜率：${winRate.value}%\n是否开始下一局？`,
      confirmText: '下一局',
      cancelText: '统计',
      success: (res) => {
        if (res.confirm) {
          initDeck()
          handsPlayed.value = 0
          successCount.value = 0
          failCount.value = 0
          handRecorded.value = false
          sessionOver.value = false
          nextTick(() => nextHand())
        } else {
          try { uni.reLaunch({ url: '/pages/stats/index' }) }
          catch (e1) { try { uni.navigateTo({ url: '/pages/stats/index' }) } catch (_) {} }
        }
      }
    })
  } catch (_) { /* noop */ }
}
</script>

<style scoped> 
.page { min-height: 100dvh; min-height: calc(var(--vh, 1vh) * 100); background: #f8fafc; display:flex; flex-direction: column; } 
.page { opacity: 0; } 
.page.booted { animation: page-fade-in .28s ease-out forwards; } 
.topbar { padding: 12rpx 0; } 
.topbar-title { font-size: 36rpx; font-weight: 700; color:#1f2937; text-align:center; width:100%; display:block; } 
 
/* 牌区 */ 
.card-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; } 
.playing-card { background:#fff; border-radius:16rpx; overflow:hidden; box-shadow:0 8rpx 20rpx rgba(15,23,42,.08); border:1rpx solid #e5e7eb; } 
.playing-card.used { filter: grayscale(1) saturate(.2); opacity:.5; } 
.card-img { width:100%; height:auto; display:block; } 

/* 运算符与按钮 */
.ops-row-1 { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.ops-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:18rpx; align-items:stretch; }
.ops-left { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.pair-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.mode-btn { width: 100%; white-space: nowrap; }

.btn { border:none; border-radius:16rpx; padding:28rpx 0; font-size:32rpx; line-height:1; box-shadow:0 8rpx 20rpx rgba(15,23,42,.06); width:100%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; } 
.btn-operator { background:#fff; color:#2563eb; border:2rpx solid #e5e7eb; } 
.btn-primary { background:#145751; color:#fff; } 
/* 使用全局 .btn-secondary 样式（uni.scss）以保持一致性 */ 

/* 成功动画覆盖层 */
.success-overlay { position:absolute; left:0; right:0; top:0; bottom:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
.success-burst { background: rgba(34,197,94,0.92); color:#fff; font-weight:800; font-size:64rpx; padding:40rpx 60rpx; border-radius:9999rpx; box-shadow:0 16rpx 40rpx rgba(34,197,94,.35); animation: success-pop .5s ease-out both; }
.error-burst { background: rgba(239,68,68,0.92); color:#fff; font-weight:800; font-size:48rpx; padding:28rpx 40rpx; border-radius:9999rpx; box-shadow:0 16rpx 40rpx rgba(239,68,68,.35); animation: success-pop .5s ease-out both; display:flex; flex-direction:column; align-items:center; gap:6rpx }
.error-burst .err-title{ font-size:48rpx; font-weight:800 }
.error-burst .err-val{ font-size:28rpx; font-weight:700; opacity:.95 }
@keyframes success-pop { 0% { transform: scale(.6); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

/* 表达式区 */
.expr-card { background:#fff; padding:20rpx; border-radius:16rpx; border:2rpx solid #e5e7eb; box-shadow:0 6rpx 20rpx rgba(0,0,0,.06); } 
.expr-title { margin-top: 0; color:#111827; font-size:30rpx; font-weight:600; }
.status-text { color:#1f2937; font-weight:700; }
.expr-zone { --tok-card-h: 112rpx; --card-w-ratio: 0.714; margin-top: 8rpx; background:#f5f7fb; border:2rpx dashed #d1d5db; border-radius:24rpx; padding:28rpx; overflow:hidden; }
.expr-zone-active { border-color:#3a7afe; }
.expr-placeholder { color:#9ca3af; text-align:center; margin-top: 8rpx; }
.expr-row { display:inline-flex; flex-wrap:nowrap; white-space:nowrap; gap:12rpx; align-items:center; }
.tok { color:#1f3a93; border-radius:14rpx; transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease; }
.tok.num { padding:0; border:none; background:transparent; width: calc(var(--tok-card-h) * var(--card-w-ratio)); height: var(--tok-card-h); display:inline-block; }
.tok-card-img { width:100%; height:100%; object-fit: contain; display:block; border-radius:14rpx; box-shadow:0 6rpx 20rpx rgba(15,23,42,.08); }
.tok.op { height: var(--tok-card-h); width: calc(var(--tok-card-h) * var(--card-w-ratio) / 2); padding: 0; font-size: calc(var(--tok-card-h) * 0.42); background:#fff; border:2rpx solid #e5e7eb; display:flex; align-items:center; justify-content:center; box-shadow:0 6rpx 20rpx rgba(15,23,42,.06); box-sizing: border-box; }
.tok.dragging { opacity:.6; box-shadow:0 6rpx 24rpx rgba(0,0,0,.18); }
.tok.just-inserted { animation: pop-in 200ms ease-out; }
.insert-placeholder { border-radius:14rpx; border:2rpx dashed #3a7afe; background:#eaf1ff; opacity:.9; position:relative; overflow:hidden; }
.insert-placeholder.num { min-width: calc(var(--tok-card-h) * var(--card-w-ratio)); min-height: var(--tok-card-h); margin:2rpx; }
.insert-placeholder.op { min-width: calc(var(--tok-card-h) * var(--card-w-ratio) / 2); min-height: var(--tok-card-h); margin:2rpx; }
.insert-placeholder::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(60deg, rgba(58,122,254,0.05) 0, rgba(58,122,254,0.05) 8rpx, rgba(58,122,254,0.18) 8rpx, rgba(58,122,254,0.18) 16rpx); background-size:200% 100%; animation:shimmer 1.2s linear infinite; }
.drag-ghost { position:fixed; z-index:9999; background:#3a7afe; color:#fff; padding:16rpx 22rpx; border-radius:10rpx; font-size:32rpx; pointer-events:none; }

/* 提示 */
.hint-text { font-size: 28rpx; color:#6b7280; text-align:center; }
.hint-text.error { color:#dc2626; font-weight:700 }

/* 统计：单行紧凑 */
.stats-card { background:#fff; border:2rpx solid #e5e7eb; border-radius:16rpx; padding:16rpx; } 
.stats-compact-table { display:grid; grid-template-rows:auto auto; row-gap:8rpx; }
.stats-compact-table .thead, .stats-compact-table .tbody { display:grid; grid-template-columns: repeat(7, 1fr); align-items:center; column-gap:12rpx; }
.stats-compact-table .thead { color:#6b7280; font-weight:700; font-size:26rpx; text-align: center;}
.stats-compact-table .tbody { font-size:28rpx; text-align: center;}
.stats-compact-table .ok { color:#16a34a; font-weight:700 }
.stats-compact-table .fail { color:#dc2626; font-weight:700 }
.stats-one-line .stats-item { display:flex; align-items:center; gap:6rpx; padding:4rpx 8rpx; border-right:2rpx solid #e5e7eb; }
.stats-one-line .stats-item:last-child { border-right:none; }
.stat-label { color:#6b7280; font-size:26rpx; }
.stat-label.ok, .stat-value.ok { color:#16a34a; font-weight:700 }
.stat-label.fail, .stat-value.fail { color:#dc2626; font-weight:700 }
.stat-value { font-weight:700; color:#111827; font-size:28rpx; }
 
.btn-reshuffle { padding: 12rpx 0; font-size: 26rpx; line-height: 1; }

@keyframes pop-in { from { transform:scale(0.85); opacity:.2; } to { transform:scale(1); opacity:1; } }
@keyframes shimmer { from { background-position-x:0%; } to { background-position-x:200%; } }
@keyframes page-fade-in { from { opacity: 0; } to { opacity: 1; } }
</style>





