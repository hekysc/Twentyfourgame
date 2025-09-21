<template>
  <view
    class="page col"
    :class="{ booted }"
    style="padding: 24rpx; gap: 16rpx; position: relative;"
    @touchstart="edgeHandlers.handleTouchStart"
    @touchmove="edgeHandlers.handleTouchMove"
    @touchend="edgeHandlers.handleTouchEnd"
    @touchcancel="edgeHandlers.handleTouchCancel"
  >

    <!-- 顶部：当前用户与切换 -->
    <view class="topbar theme-panel">
      <view class="panel-decoration topbar-decoration">
        <view class="panel-aurora"></view>
        <view class="panel-badge">玩家</view>
      </view>
      <view class="topbar-content">
        <text class="topbar-title">当前用户：{{ currentUser && currentUser.name ? currentUser.name : '未选择' }}</text>
        <button class="btn btn-secondary topbar-action" @click="goLogin">切换用户</button>
      </view>
    </view>

    <view class="mode-bar theme-panel">
      <view class="panel-decoration mode-bar-decoration">
        <view class="panel-aurora"></view>
        <view class="panel-badge">模式</view>
      </view>
      <view class="mode-bar-content">
        <button
          class="btn mode-toggle-btn"
          :class="mode === 'pro' ? 'mode-toggle-pro' : 'mode-toggle-basic'"
          @click="toggleMode"
        >{{ modeButtonLabel }}</button>
        <view class="mode-bar-secondary">
          <button
            class="btn btn-secondary deck-toggle-btn"
            @click="toggleDeckSource"
          >{{ deckSourceLabel }}</button>
        </view>
      </view>
    </view>

    <!-- 本局统计：紧凑表格（1行表头 + 1行数据） -->
      <view id="statsRow" class="card section stats-card theme-panel">
        <view class="panel-decoration stats-decoration">
          <view class="panel-aurora"></view>
          <view class="panel-badge">统计</view>
        </view>
        <view class="stats-compact-table">
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
          <view class="td timer-cell" id="timerCell" @tap="handleTimerTap">
            <block v-if="handElapsedMs < 120000">
              <text>{{ fmtMs1(handElapsedMs) }}</text>
            </block>
            <block v-else>
              <button class="btn btn-secondary btn-reshuffle" @click.stop="reshuffle">洗牌</button>
            </block>
          </view>
        </view>
      </view>
    </view>
    <template v-if="mode === 'pro'">
      <!-- 牌区：四张卡片等宽占满一行（每张卡片单独计数） -->
      <view id="cardGrid" class="card-grid theme-panel">
        <view class="panel-decoration card-grid-decoration">
          <view class="panel-aurora"></view>
          <view class="panel-badge">手牌</view>
        </view>
        <view class="card-grid-inner">
          <view v-for="(card, idx) in cards" :key="idx"
                class="playing-card"
                :class="{ used: (usedByCard[idx]||0) > 0 }"
                @touchstart.stop.prevent="startDrag({ type: 'num', value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event)"
                @touchmove.stop.prevent="onDrag($event)"
                @touchend.stop.prevent="endDrag()">
            <image class="card-img" :src="cardImage(card)" mode="widthFix"/>
          </view>
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
      <view class="expr-card card section theme-panel">
        <view class="panel-decoration expr-decoration">
          <view class="panel-aurora"></view>
          <view class="panel-badge">表达式</view>
        </view>
        <view class="expr-card-body">
          <view
            id="exprZone"
            class="expr-zone"
            :class="{ 'expr-zone-active': drag.active, empty: tokens.length === 0 && !exprOverrideText }"
            :style="{ height: exprZoneHeight + 'px' }"
          >
            <view v-if="exprOverrideText" class="expr-override">{{ exprOverrideText }}</view>
            <view id="exprRow" class="row expr-row" :style="{ transform: 'scale(' + exprScale + ')', transformOrigin: 'left center'}">
              <block v-for="(t, i) in tokens" :key="i">
                <view v-if="dragInsertIndex === i" class="insert-placeholder" :class="placeholderSizeClass"></view>
                <view class="tok" :class="[ (t.type === 'num' ? 'num' : 'op'), { 'just-inserted': i === lastInsertedIndex, 'dragging': drag.token && drag.token.type==='tok' && drag.token.index===i } ]"
                      @touchstart.stop.prevent="startDrag({ type: 'tok', index: i, value: t.value }, $event)"
                      @touchmove.stop.prevent="onDrag($event)"
                      @touchend.stop.prevent="endDrag()">
                  <image v-if="t.type==='num'" class="tok-card-img" :src="cardImage({ rank: t.rank || +t.value, suit: t.suit || 'S'})" mode="heightFix"/>
                  <text v-else class="tok-op-text">{{ t.value }}</text>
                </view>
              </block>
              <view v-if="dragInsertIndex === tokens.length" class="insert-placeholder" :class="placeholderSizeClass"></view>
            </view>
          </view>
        </view>
      </view>
    </template>
    <template v-else>
      <view class="basic-mode">
        <view class="basic-board">
          <view class="basic-column">
            <view v-for="i in [0, 2]" :key="'basic-left-' + i" class="basic-card-wrapper">
              <view :class="['basic-card', basicCardClass(i)]" @tap="handleBasicCardTap(i)">
                <image v-if="basicSlots[i] && basicSlots[i].alive && basicSlots[i].source === 'card'" class="basic-card-img" :src="cardImage(basicSlots[i].card)" mode="widthFix" />
                <view v-else-if="basicSlots[i] && basicSlots[i].alive" class="basic-card-value">
                  <text class="basic-card-value-text">{{ basicSlots[i].label }}</text>
                </view>
              </view>
            </view>
          </view>
          <view class="basic-ops">
            <button v-for="op in ['+','-','×','÷']" :key="'basic-op-' + op" class="btn btn-operator" :class="{ active: basicSelection.operator === op }" @tap="handleBasicOperator(op)">{{ op }}</button>
            <button class="btn btn-secondary mode-btn basic-face-toggle" @click="toggleFaceMode">{{ faceUseHigh ? 'J/Q/K=11/12/13' : 'J/Q/K=1' }}</button>
          </view>
          <view class="basic-column">
            <view v-for="i in [1, 3]" :key="'basic-right-' + i" class="basic-card-wrapper">
              <view :class="['basic-card', basicCardClass(i)]" @tap="handleBasicCardTap(i)">
                <image v-if="basicSlots[i] && basicSlots[i].alive && basicSlots[i].source === 'card'" class="basic-card-img" :src="cardImage(basicSlots[i].card)" mode="widthFix" />
                <view v-else-if="basicSlots[i] && basicSlots[i].alive" class="basic-card-value">
                  <text class="basic-card-value-text">{{ basicSlots[i].label }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <view v-if="mode === 'pro'" id="submitRow">
      <button class="btn btn-primary" style="width:100%" @click="check">提交答案</button>
    </view>

    <view v-if="mode === 'pro'" id="failRow" class="pair-grid">
      <button class="btn btn-secondary" @click="showSolution">提示</button>
      <button class="btn btn-secondary" @click="skipHand">下一题</button>
    </view>
    <view v-else class="basic-actions">
      <button class="btn btn-secondary" :disabled="!basicHistory.length" @click="undoBasicStep">后退</button>
      <button class="btn btn-secondary" @click="resetBasicBoard">重置</button>
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
    <view
      v-if="timerPopover.visible"
      class="timer-popover-layer"
      @tap="closeTimerPopover"
    >
      <view class="timer-popover" :style="timerPopoverStyle" @tap.stop>
        <button class="timer-popover-item" @tap="redealHand">重新发牌</button>
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
import { ref, onMounted, onUnmounted, getCurrentInstance, computed, watch, nextTick } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import CustomTabBar from '../../components/CustomTabBar.vue'
import { evaluateExprToFraction, solve24 } from '../../utils/solver.js'
import { ensureInit, getCurrentUser, getUsers, pushRound, readStatsExtended } from '../../utils/store.js'
import {
  tokensToExpression,
  formatMs,
  formatMsShort,
  cardImagePath,
  labelForRank,
  mapCardRank,
  computeExprStats,
  isExpressionComplete,
  statsFromExpressionString,
} from '../../utils/calc.js'
import { createBasicState, combineBasicSlots, undoBasicHistory } from '../../core/basic-mode.js'
import { drawSolvableHand, newDeck } from '../../core/game-engine.js'
import { getActivePool, recordRoundResult } from '../../utils/mistakes.js'
import { useFloatingHint } from '../../utils/hints.js'
import { useEdgeExit } from '../../utils/edge-exit.js'
import { getLastMode, setLastMode } from '../../utils/prefs.js'
import { consumeAvatarRestoreNotice } from '../../utils/avatar.js'
import { exitApp } from '../../utils/navigation.js'

const cards = ref([{ rank:1, suit:'S' }, { rank:5, suit:'H' }, { rank:5, suit:'D' }, { rank:5, suit:'C' }])
const solution = ref(null)
const usedByCard = ref([0,0,0,0])
const tokens = ref([])
let initialMode = 'basic'
try { const savedMode = getLastMode(); if (savedMode === 'pro' || savedMode === 'basic') initialMode = savedMode } catch (_) {}
const mode = ref(initialMode)
try { setLastMode(initialMode) } catch (_) {}
const modeButtonLabel = computed(() => mode.value === 'pro' ? 'Pro模式' : 'Basic模式')
const basicSlots = ref([])
const basicSelection = ref({ first: null, operator: null })
const basicHistory = ref([])
const basicExpression = ref('')
const basicDisplayExpression = ref('')
const faceUseHigh = ref(false)
const handRecorded = ref(false)
const exprZoneHeight = ref(200)
const currentUser = ref(null)
const deck = ref([])
const deckSource = ref('normal')
const deckSourceLabel = computed(() => deckSource.value === 'mistake' ? '题库：错题' : '题库：整副')
const mistakeRunUsed = ref(new Set())
const mistakeRunStamp = ref(0)
const currentHandSource = ref('normal')
const currentMistakeKey = ref('')
const handsPlayed = ref(0)
const successCount = ref(0)
const failCount = ref(0)
const sessionOver = ref(false)
const timerPopover = ref({ visible: false, left: 0, top: 0 })
const timerPopoverStyle = computed(() => ({ left: `${timerPopover.value.left}px`, top: `${timerPopover.value.top}px` }))
const successAnimating = ref(false)
const errorAnimating = ref(false)
const exprOverrideText = ref('')
const errorValueText = ref('')
const handStartTs = ref(Date.now())
const nowTs = ref(Date.now())
const hintWasUsed = ref(false)
const attemptCount = ref(0)
const lastSuccessMs = ref(null)
const SESSION_KEY = 'tf24_game_session_v1'
const handSettled = ref(false);          // 是否已对本手“结算”（成功或失败）
const settledResult = ref(null);         // 'success' | 'fail' | null
const handFailedOnce = ref(false);       // Basic 模式失败是否已记录

const { hintState, showHint, hideHint } = useFloatingHint()

const basicErrorMessages = {
  SAME_INDEX: '请选择另一张牌',
  INACTIVE_SLOT: '请选择有效的数字',
  DIVIDE_BY_ZERO: '除数不能为 0',
  INVALID_OPERATION: '无法进行该运算，请重试',
}

function showBasicError(code) {
  const msg = basicErrorMessages[code] || '操作无效，请重试'
  showHint(msg, { interactive: true })
}
const edgeHandlers = useEdgeExit({ showHint, onExit: () => exitGamePage() })

const fmtMs = formatMs
const fmtMs1 = formatMsShort
const cardImage = cardImagePath

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
      handFailedOnce: !!handFailedOnce.value,
      solution: solution.value || null, // persisted solution to avoid "暂无提示" after restore
      deckSource: deckSource.value || 'normal',
      mistakeRunUsed: Array.from(mistakeRunUsed.value || []),
      mistakeRunStamp: mistakeRunStamp.value || 0,
      currentHandSource: currentHandSource.value || 'normal',
      currentMistakeKey: currentMistakeKey.value || '',
      mode: mode.value || 'basic',
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
      resetBasicStateFromCards()
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
      handFailedOnce.value = !!data.handFailedOnce
      // 恢复 solution（向后兼容老会话）
      solution.value = data.solution || null
      deckSource.value = data.deckSource === 'mistake' ? 'mistake' : 'normal'
      mistakeRunUsed.value = new Set(Array.isArray(data.mistakeRunUsed) ? data.mistakeRunUsed : [])
      mistakeRunStamp.value = data.mistakeRunStamp || 0
      currentHandSource.value = data.currentHandSource === 'mistake' ? 'mistake' : 'normal'
      currentMistakeKey.value = typeof data.currentMistakeKey === 'string' ? data.currentMistakeKey : ''
      const restoredMode = data.mode === 'pro' ? 'pro' : 'basic'
      mode.value = restoredMode
      try { setLastMode(restoredMode) } catch (_) {}
      closeTimerPopover()
      // 如果没有 solution，则基于当前 cards 即时计算一份（兜底）
      if (!solution.value) {
        try {
          const mapped = (cards.value || []).map(c => mapCardRank(c.rank, faceUseHigh.value))
          solution.value = mapped.length === 4 ? solve24(mapped) : null
        } catch (_) { solution.value = null }
      }
      nextTick(() => { updateVHVar(); updateExprScale(); recomputeExprHeight() })
      return true
    }
    return false
  } catch (_) { return false }
}

const remainingCards = computed(() => {
  if (deckSource.value === 'mistake') {
    const uid = selectedUserId.value
    if (!uid) return 0
    const pool = getActivePool(uid) || []
    if (!Array.isArray(pool) || pool.length === 0) return 0
    const used = mistakeRunUsed.value instanceof Set ? mistakeRunUsed.value : new Set()
    let remainingHands = 0
    for (const item of pool) {
      if (!item || !item.key) continue
      if (!used.has(item.key)) remainingHands += 1
    }
    return remainingHands * 4
  }
  return Array.isArray(deck.value) ? deck.value.length : 0
})
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
const selectedUserId = computed(() => (currentUser.value && currentUser.value.id) ? currentUser.value.id : '')
const currentHandNums = computed(() => {
  const arr = (cards.value || []).map(c => c.rank)
  return arr.sort((a, b) => a - b)
})

watch(selectedUserId, (newId, oldId) => {
  if (newId === oldId) return
  const inMistake = deckSource.value === 'mistake'
  resetMistakeRun(inMistake ? Date.now() : 0)
  if (!newId && inMistake) {
    deckSource.value = 'normal'
    resetMistakeRun(0)
    nextTick(() => { nextHand() })
  } else if (inMistake && newId) {
    nextTick(() => { nextHand() })
  }
})

const expr = computed(() => tokensToExpression(tokens.value, faceUseHigh.value))
const ghostStyle = computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`)
const exprScale = ref(1)
const opsDensity = ref('normal') // normal | compact | tight
const opsDensityClass = computed(() => opsDensity.value === 'tight' ? 'ops-tight' : (opsDensity.value === 'compact' ? 'ops-compact' : ''))
const ghostText = computed(() => {
  const t = drag.value.token
  if (!t) return ''
  if (t.type === 'num') return labelForRank(t.rank || +t.value)
  if (t.type === 'tok') return /^(10|11|12|13|[1-9])$/.test(t.value) ? labelForRank(+t.value) : t.value
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

function clearExprOverride() {
  if (exprOverrideText.value) exprOverrideText.value = ''
}

function showExpressionErrorToast() { showHint('表达式不合法，请重试', 1600) }

function basicCardClass(idx) {
  const slot = basicSlots.value[idx]
  return {
    hidden: !slot || !slot.alive,
    selected: basicSelection.value.first === idx,
    result: !!(slot && slot.alive && slot.source === 'value'),
  }
}


function resetBasicStateFromCards() {
  const base = createBasicState(cards.value || [], faceUseHigh.value)
  basicSlots.value = base.slots
  basicSelection.value = { first: null, operator: null }
  basicHistory.value = []
  basicExpression.value = base.expression
  basicDisplayExpression.value = base.displayExpression
}

function handleBasicOperator(op) {
  if (mode.value !== 'basic' || handSettled.value) return
  if (basicSelection.value.first === null) {
    showHint('请先选择一个数字', { interactive: true })
    return
  }
  if (basicSelection.value.operator === op) {
    basicSelection.value.operator = null
    return
  }
  basicSelection.value.operator = op
}

function handleBasicCardTap(idx) {
  if (mode.value !== 'basic' || handSettled.value) return
  const slot = basicSlots.value[idx]
  if (!slot || !slot.alive) return
  const selection = basicSelection.value
  if (selection.operator && selection.first !== null) {
    if (selection.first === idx) {
      basicSelection.value = { first: null, operator: null }
      return
    }
    applyBasicCombination(selection.first, idx, selection.operator)
    return
  }
  if (selection.first === idx) {
    basicSelection.value = { first: null, operator: null }
    return
  }
  basicSelection.value = { first: idx, operator: null }
}

function applyBasicCombination(firstIdx, secondIdx, op) {
  const res = combineBasicSlots({
    slots: basicSlots.value,
    history: basicHistory.value,
    expression: basicExpression.value,
    displayExpression: basicDisplayExpression.value,
  }, firstIdx, secondIdx, op)

  if (!res.ok) {
    basicSelection.value = { first: null, operator: null }
    if (res.err) {
      showBasicError(res.err)
    }
    return
  }

  const data = res.data
  basicSlots.value = data.slots
  basicHistory.value = data.history
  basicExpression.value = data.expression
  basicDisplayExpression.value = data.displayExpression


  // 找到运算结果所在的槽位
  let resultSlotIndex = null
  for (let i = 0; i < data.slots.length; i++) {
    if (data.slots[i] && data.slots[i].alive && data.slots[i].source === 'value') {
      resultSlotIndex = i
      break
    }
  }

  basicSelection.value = { first: resultSlotIndex, operator: null }
  errorValueText.value = ''

  if (data.aliveCount === 1) {
    settleHandResult({
      ok: !!data.isSolved,
      expression: data.exprForRecord,
      valueFraction: data.result,
      stats: data.stats,
      origin: 'basic',
      allowRetry: !data.isSolved,
    })
  }
  try { saveSession() } catch (_) {}
}

function undoBasicStep() {
  const res = undoBasicHistory(basicHistory.value)
  if (!res.ok) return
  const data = res.data
  basicHistory.value = data.history
  basicSlots.value = data.slots
  basicExpression.value = data.expression
  basicDisplayExpression.value = data.displayExpression
  basicSelection.value = { first: null, operator: null }
  errorValueText.value = ''
  try { saveSession() } catch (_) {}
}

function resetBasicBoard() {
  resetBasicStateFromCards()
  errorValueText.value = ''
  try { saveSession() } catch (_) {}
}

function toggleMode() { mode.value = mode.value === 'pro' ? 'basic' : 'pro' }

function refresh() { nextHand() }

function initDeck() {
  deck.value = newDeck()
}

function closeTimerPopover() { timerPopover.value = { visible: false, left: 0, top: 0 } }

function openTimerPopover() {
  try {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#timerCell').boundingClientRect().exec(res => {
      const [rect] = res || []
      if (!rect) {
        timerPopover.value = { visible: true, left: 0, top: 0 }
        return
      }
      const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
      let top = (rect.bottom || (rect.top || 0) + (rect.height || 0)) + 8
      const limit = (sys && Number.isFinite(sys.windowHeight)) ? sys.windowHeight - 96 : 0
      if (limit && top > limit) top = limit
      const center = rect.left + rect.width / 2
      timerPopover.value = { visible: true, left: center, top }
    })
  } catch (_) {
    timerPopover.value = { visible: true, left: 0, top: 0 }
  }
}

function handleTimerTap() {
  if (timerPopover.value.visible) {
    closeTimerPopover()
  } else {
    openTimerPopover()
  }
}

function redealHand() {
  closeTimerPopover()
  errorValueText.value = ''
  exprOverrideText.value = ''
  nextHand()
}

async function nextHand() {
  closeTimerPopover()
  const res = await getNextDraw()
  if (!res) return

  resetHandStateForNext()
  if (Array.isArray(res.deck)) deck.value = res.deck
  cards.value = Array.isArray(res.cards) ? res.cards : []
  currentHandSource.value = res.source === 'mistake' ? 'mistake' : 'normal'
  currentMistakeKey.value = res.source === 'mistake' ? (res.mistakeKey || '') : ''
  solution.value = res.solution || null
  tokens.value = []
  usedByCard.value = [0, 0, 0, 0]
  handRecorded.value = false
  handStartTs.value = Date.now()
  hintWasUsed.value = false
  attemptCount.value = 0
  nextTick(() => recomputeExprHeight())
  try { saveSession() } catch (_) {}
}

async function getNextDraw() {
  if (deckSource.value === 'mistake') {
    return await drawFromMistakePool()
  }
  return await drawFromNormalDeck()
}

async function drawFromNormalDeck() {
  if (!Array.isArray(deck.value) || deck.value.length < 4) {
    initDeck()
  }
  if (!Array.isArray(deck.value) || deck.value.length < 4) {
    promptDeckReshuffle()
    return null
  }
  const res = drawSolvableHand(deck.value, faceUseHigh.value, solve24)
  if (!res.ok) {
    promptDeckReshuffle()
    return null
  }
  return { source: 'normal', cards: res.data.cards, deck: res.data.deck, solution: res.data.solution }
}

async function drawFromMistakePool() {
  const uid = selectedUserId.value
  if (!uid) {
    showHint('请先选择用户', 1600)
    deckSource.value = 'normal'
    try { saveSession() } catch (_) {}
    return await drawFromNormalDeck()
  }
  const pool = getActivePool(uid) || []
  if (!Array.isArray(pool) || pool.length === 0) {
    await new Promise(resolve => {
      const fallback = () => {
        switchDeckSource('normal')
        resolve(null)
      }
      try {
        uni.showModal({
          title: '提示',
          content: '无错题，切换到整副牌。',
          confirmText: 'OK',
          showCancel: false,
          success: () => fallback(),
          fail: () => fallback(),
        })
      } catch (_) {
        fallback()
      }
    })
    return null
  }
  const used = mistakeRunUsed.value instanceof Set ? mistakeRunUsed.value : new Set()
  const available = pool.filter(item => item && item.key && !used.has(item.key))
  if (!available.length) {
    await new Promise(resolve => {
      const fallback = () => {
        restartMistakeRun()
        resolve(null)
      }
      try {
        uni.showActionSheet({
          title: '本轮错题已出完',
          itemList: ['重新出题', '切换整副', '去统计'],
          success: (res) => {
            const idx = typeof res?.tapIndex === 'number' ? res.tapIndex : -1
            if (idx === 0) {
              restartMistakeRun()
            } else if (idx === 1) {
              switchDeckSource('normal')
            } else if (idx === 2) {
              goStats()
            } else {
              restartMistakeRun()
            }
            resolve(null)
          },
          fail: () => fallback(),
        })
      } catch (_) {
        fallback()
      }
    })
    return null
  }
  const item = available[Math.floor(Math.random() * available.length)]
  const cardsFromNums = convertNumsToCards(Array.isArray(item?.nums) ? item.nums : [])
  let sol = null
  try {
    const mapped = cardsFromNums.map(c => mapCardRank(c.rank, faceUseHigh.value))
    sol = mapped.length === 4 ? solve24(mapped) : null
  } catch (_) {
    sol = null
  }
  const updatedSet = new Set(used)
  updatedSet.add(item.key)
  mistakeRunUsed.value = updatedSet
  try { saveSession() } catch (_) {}
  return { source: 'mistake', cards: cardsFromNums, deck: deck.value, solution: sol, mistakeKey: item.key }
}

function convertNumsToCards(nums) {
  const suits = ['S', 'H', 'D', 'C']
  const arr = Array.isArray(nums) ? nums : []
  return arr.map((n, idx) => {
    const rank = Number.isFinite(+n) ? Math.min(13, Math.max(1, Math.floor(+n))) : 1
    const suit = suits[idx % suits.length]
    return { rank, suit }
  })
}

function resetMistakeRun(stamp = 0) {
  mistakeRunUsed.value = new Set()
  mistakeRunStamp.value = stamp
  currentMistakeKey.value = ''
}

function restartMistakeRun() {
  resetMistakeRun(Date.now())
  try { saveSession() } catch (_) {}
  nextTick(() => { if (deckSource.value === 'mistake') nextHand() })
}

function toggleDeckSource() {
  const next = deckSource.value === 'mistake' ? 'normal' : 'mistake'
  switchDeckSource(next)
}

function switchDeckSource(target) {
  const next = target === 'mistake' ? 'mistake' : 'normal'
  if (deckSource.value === next) return
  if (next === 'mistake') {
    if (!selectedUserId.value) {
      showHint('请先选择用户', 1600)
      return
    }
    deckSource.value = 'mistake'
    // 不再在切换到错题库时重置错题运行集合，保留进度
    try { saveSession() } catch (_) {}
    nextTick(() => { nextHand() })
    return
  }
  deckSource.value = 'normal'
  // 切换到整副时也不重置错题运行集合，便于切回后继续减少剩余
  if (!Array.isArray(deck.value) || deck.value.length < 4) initDeck()
  try { saveSession() } catch (_) {}
  nextTick(() => { nextHand() })
}

function promptDeckReshuffle() {
  try {
    uni.showModal({
      title: '牌库用尽',
      content: '余牌无解或整副用完，是否重新洗牌？',
      confirmText: '重洗',
      cancelText: '进入统计',
      success: (res) => {
        if (res.confirm) {
          initDeck()
          handsPlayed.value = 0
          successCount.value = 0
          failCount.value = 0
          nextTick(() => nextHand())
        } else {
          try { uni.reLaunch({ url: '/pages/stats/index' }) }
          catch (e1) { try { uni.navigateTo({ url: '/pages/stats/index' }) } catch (_) {} }
        }
      },
    })
  } catch (_) {
    initDeck()
    handsPlayed.value = 0
    successCount.value = 0
    failCount.value = 0
    nextTick(() => nextHand())
  }
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
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
})

onShow(() => {
  currentUser.value = getCurrentUser() || null
  loadSession()
  startHandTimer()
  try { uni.$emit && uni.$emit('tabbar:update') } catch (_) {}
  if (consumeAvatarRestoreNotice()) {
    showHint('头像文件丢失，已为你恢复为默认头像', 2000)
  }
})
onHide(() => { saveSession(); stopHandTimer(); closeTimerPopover() })
onUnmounted(() => { stopHandTimer() })

// 已移除“清空表达式”功能，避免误触清空

function updateLastSuccess() {
  try {
    const cu = getCurrentUser && getCurrentUser()
    if (!cu || !cu.id) { lastSuccessMs.value = null; return }
    const ext = readStatsExtended && readStatsExtended(cu.id)
    const r = (ext && Array.isArray(ext.rounds) ? ext.rounds.slice().reverse() : []).find(x => x && x.success && Number.isFinite(x.timeMs))
    lastSuccessMs.value = r ? r.timeMs : null
  } catch (_) { lastSuccessMs.value = null }
}

function resetHandStateForNext() {
  handSettled.value = false;
  settledResult.value = null;
  handFailedOnce.value = false;
  // 你已有的重置：handRecorded、attemptCount、hintWasUsed、errorValueText 等
  handRecorded.value = false;  // 若你还在别处用到它，这里也清掉
  attemptCount.value = 0;
  hintWasUsed.value = false;
  errorValueText.value = '';
  exprOverrideText.value = '';
  // handStartTs 在发新题时重置
}

function settleHandResult({ ok, expression, valueFraction, stats, origin, allowRetry = false }) {
  const exprStr = expression || ''
  const statsData = stats || statsFromExpressionString(exprStr)
  const value = valueFraction || (exprStr ? evaluateExprToFraction(exprStr) : null)
  const elapsed = Date.now() - (handStartTs.value || Date.now())
  const retriesSuccess = origin === 'pro' ? Math.max(0, (attemptCount.value || 1) - 1) : 0
  const retriesFail = origin === 'pro' ? (attemptCount.value || 0) : 0
  const retryableFailure = allowRetry && !ok

  const recordRound = (success) => {
    if (selectedUserId.value) {
      try { recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success }) } catch (_) {}
    }
    try {
      pushRound({
        success,
        timeMs: elapsed,
        hintUsed: !!hintWasUsed.value,
        retries: success ? retriesSuccess : retriesFail,
        ops: statsData.ops,
        exprLen: statsData.exprLen,
        maxDepth: statsData.maxDepth,
        faceUseHigh: !!faceUseHigh.value,
        hand: { cards: (cards.value || []).map(c => ({ rank: c.rank, suit: c.suit })) },
        expr: exprStr,
      })
      if (success) updateLastSuccess()
    } catch (_) {}
  }

  if (ok) {
    errorValueText.value = ''
    if (origin === 'basic' && handFailedOnce.value) {
      try {
        successAnimating.value = true
        setTimeout(() => { successAnimating.value = false }, 500)
      } catch (_) {}
      try { saveSession() } catch (_) {}
      return
    }

    if (handSettled.value) {
      if (settledResult.value === 'success') {
        try { saveSession() } catch (_) {}
        return
      }
      try {
        successAnimating.value = true
        setTimeout(() => { successAnimating.value = false; nextHand() }, 500)
      } catch (_) { nextHand() }
      try { saveSession() } catch (_) {}
      return
    }

    handSettled.value = true
    settledResult.value = 'success'
    handRecorded.value = true
    handsPlayed.value += 1
    successCount.value += 1
    recordRound(true)
    try {
      successAnimating.value = true
      setTimeout(() => { successAnimating.value = false; nextHand() }, 500)
    } catch (_) { nextHand() }
    try { saveSession() } catch (_) {}
    return
  }

  const updateErrorValue = () => {
    try {
      if (value && typeof value.toString === 'function') {
        errorValueText.value = '结果：' + value.toString()
      } else {
        errorValueText.value = ''
      }
    } catch (_) {
      errorValueText.value = ''
    }
  }

  if (retryableFailure) {
    updateErrorValue()
    if (!handFailedOnce.value) {
      handFailedOnce.value = true
      settledResult.value = 'fail'
      handRecorded.value = true
      handsPlayed.value += 1
      failCount.value += 1
      recordRound(false)
    }
    try {
      errorAnimating.value = true
      setTimeout(() => { errorAnimating.value = false }, 500)
    } catch (_) {}
    try { saveSession() } catch (_) {}
    return
  }

  updateErrorValue()
  if (!handSettled.value) {
    handSettled.value = true
    settledResult.value = 'fail'
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    recordRound(false)
  }
  try {
    errorAnimating.value = true
    setTimeout(() => { errorAnimating.value = false }, 500)
  } catch (_) {}
  try { saveSession() } catch (_) {}
}

function check() {
  const usedCount = usedByCard.value.reduce((a, b) => a + (b ? 1 : 0), 0)
  errorValueText.value = ''
  if (usedCount !== 4 || !isExpressionComplete(tokens.value)) {
    showExpressionErrorToast()
    return
  }

  const s = expr.value
  if (!s) {
    showExpressionErrorToast()
    return
  }

  attemptCount.value += 1
  const v = evaluateExprToFraction(s)
  const ok = (v && v.equalsInt && v.equalsInt(24))
  settleHandResult({
    ok,
    expression: s,
    valueFraction: v,
    stats: computeExprStats(tokens.value),
    origin: 'pro',
  })
}

function showSolution() {
  hintWasUsed.value = true

  // 兜底：若 solution 为空，尝试即时计算一份
  if (!solution.value) {
    try {
      const mapped = (cards.value || []).map(c => mapCardRank(c.rank, faceUseHigh.value))
      solution.value = mapped.length === 4 ? solve24(mapped) : null
    } catch (_) { solution.value = null }
  }

  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try {
      const stats = computeExprStats(tokens.value)
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
    if (selectedUserId.value) {
      try { recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success: false }) } catch (_) {}
    }
  }
  if (mode.value === 'basic') {
    handFailedOnce.value = true
    const msg = solution.value ? ('答案：' + solution.value) : '暂无提示'
    basicDisplayExpression.value = msg
    showHint(msg, 2000)
  } else {
    exprOverrideText.value = solution.value ? ('答案：' + solution.value) : '暂无提示'
  }
  try { saveSession() } catch (_) {}
}

function toggleFaceMode() { faceUseHigh.value = !faceUseHigh.value }

function skipHand() {
  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try {
      const stats = computeExprStats(tokens.value)
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
    if (selectedUserId.value) {
      try { recordRoundResult({ userId: selectedUserId.value, nums: currentHandNums.value, success: false }) } catch (_) {}
    }
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
  nextTick(() => { nextHand(); saveSession() })
}

function exitGamePage() {
  if (!handRecorded.value) {
    showHint('本局进度将丢失', 1200)
  }
  exitApp({
    fallback: () => {
      try {
        if (typeof uni.switchTab === 'function') {
          uni.switchTab({ url: '/pages/stats/index' })
          return
        }
      } catch (_) {}
      try {
        if (typeof uni.reLaunch === 'function') {
          uni.reLaunch({ url: '/pages/stats/index' })
          return
        }
      } catch (_) {}
    },
  })
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
  clearExprOverride()
  const clamped = Math.max(0, Math.min(to, tokens.value.length))
  if (token.type === 'num') {
    const ci = token.cardIndex
    if (ci == null) { return }
    if ((usedByCard.value[ci] || 0) >= 1) { return }
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
  clearExprOverride()
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

watch(mode, (m) => {
  const normalized = m === 'pro' ? 'pro' : 'basic'
  try { setLastMode(normalized) } catch (_) {}
  if (normalized === 'basic') {
    exprZoneHeight.value = 70
    resetBasicStateFromCards()
    basicSelection.value = { first: null, operator: null }
  } else {
    tokens.value = []
    usedByCard.value = [0, 0, 0, 0]
    exprOverrideText.value = ''
    errorValueText.value = ''
    nextTick(() => { updateExprScale(); recomputeExprHeight() })
  }
  closeTimerPopover()
})

watch(cards, () => {
  resetBasicStateFromCards()
})

watch(faceUseHigh, () => {
  resetBasicStateFromCards()
})

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
  clearExprOverride()
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
  if (mode.value !== 'pro') {
    exprZoneHeight.value = 70
    return
  }
  const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
  const winH = sys.windowHeight || sys.screenHeight || 0
  if (winH && winH < 640) opsDensity.value = 'tight'
  else if (winH && winH < 740) opsDensity.value = 'compact'
  else opsDensity.value = 'normal'
  nextTick(() => {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#exprZone').boundingClientRect()
     .select('#opsRow1').boundingClientRect()
     .select('#opsRow2').boundingClientRect()
     .select('#submitRow').boundingClientRect()
     .select('#failRow').boundingClientRect()
     .exec(res => {
       const [exprRect, ops1Rect, ops2Rect, submitRect, failRect] = res || []
       if (!exprRect) return
       const hOps1 = (ops1Rect && ops1Rect.height) || 0
       const hOps2 = (ops2Rect && ops2Rect.height) || 0
       const hSubmit = (submitRect && submitRect.height) || 0
       const hFail = (failRect && failRect.height) || 0
       // 閫傚綋鐣欑櫧 12px
       let avail = winH - (exprRect.top || 0) - (hOps1 + hOps2 + hSubmit + hFail) - 12
       if (!isFinite(avail) || avail <= 0) avail = 120
       exprZoneHeight.value = Math.max(120, Math.floor(avail))
    })
  })
}

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
@import '@/styles/theme-panels.css';

.page { min-height: 100dvh; min-height: calc(var(--vh, 1vh) * 100); background: radial-gradient(120% 120% at 50% 0%, #172554 0%, #0f172a 55%, #020617 100%); display:flex; flex-direction: column; position: relative; overflow: hidden; }
.page::before {
  content: '';
  position: absolute;
  inset: -20% -40% -30% -40%;
  background: conic-gradient(from 0deg, rgba(56,189,248,0.2), rgba(14,165,233,0.18), rgba(168,85,247,0.16), rgba(59,130,246,0.18), rgba(56,189,248,0.2));
  filter: blur(160rpx);
  animation: bg-drift 18s linear infinite;
  opacity: 0.75;
}
.page > * { position: relative; z-index: 2; }

.page { opacity: 0; }
.page.booted { animation: page-fade-in .28s ease-out forwards; }
.topbar { padding: 34rpx 32rpx 28rpx; display:flex; flex-direction:column; gap:22rpx; }
.topbar-content { display:flex; align-items:center; justify-content:space-between; gap:18rpx; }
.topbar-title { font-size: 36rpx; font-weight: 800; color:#0f172a; text-align:left; flex:1; text-shadow:0 4rpx 12rpx rgba(148, 197, 253, 0.35); }
.topbar-action { width:auto; padding:16rpx 28rpx; font-weight:700; box-shadow:0 12rpx 28rpx rgba(56,189,248,0.32); }
 
/* 牌区 */ 
.card-grid { padding: 48rpx 28rpx 40rpx; }
.card-grid-inner { display:grid; grid-template-columns:repeat(4,1fr); gap:22rpx; }
.playing-card {
  position:relative;
  border-radius:22rpx;
  overflow:hidden;
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(224, 242, 254, 0.96) 55%, rgba(191, 219, 254, 0.95) 100%);
  border:2rpx solid rgba(96,165,250,0.45);
  box-shadow: 0 22rpx 48rpx rgba(6, 182, 212, 0.22);
  transition: transform .22s ease, box-shadow .22s ease, filter .22s ease;
  animation: card-float 7s ease-in-out infinite;
}
.playing-card::after {
  content: '';
  position:absolute;
  inset:-26%;
  background: radial-gradient(circle at 50% 20%, rgba(59,130,246,0.55), transparent 58%), radial-gradient(circle at 0% 100%, rgba(34,197,94,0.45), transparent 64%);
  filter: blur(48rpx);
  opacity:0;
  transition: opacity .24s ease;
  pointer-events:none;
}
.playing-card.used { filter: grayscale(1) saturate(.25); opacity:.55; box-shadow:none; animation:none; }
.playing-card:active,
.playing-card:focus-visible { transform: translateY(-8rpx) scale(1.03); box-shadow:0 28rpx 60rpx rgba(59,130,246,0.32); animation-play-state: paused; }
.playing-card:active::after,
.playing-card:focus-visible::after { opacity:0.55; }
@media (hover:hover) {
  .playing-card:hover { transform: translateY(-8rpx) scale(1.03); box-shadow:0 28rpx 60rpx rgba(59,130,246,0.32); animation-play-state: paused; }
  .playing-card:hover::after { opacity:0.55; }
}
.card-img { width:100%; height:auto; display:block; position:relative; z-index:3; }

/* 运算符与按钮 */
.ops-row-1 { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.ops-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:18rpx; align-items:stretch; }
.ops-left { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.pair-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.mode-bar { margin: 0; padding: 32rpx 32rpx 36rpx; display:flex; flex-direction:column; gap:26rpx; }
.mode-bar-content { display:flex; align-items:stretch; gap:18rpx; }
.mode-bar-secondary { flex:1; display:flex; align-items:stretch; }
.mode-btn { width: 100%; white-space: nowrap; }
.mode-toggle-btn { flex:1; width:100%; border:2rpx solid rgba(255,255,255,0.45); font-weight:800; letter-spacing:2rpx; text-shadow:0 4rpx 12rpx rgba(59,130,246,0.25); transition: transform .2s ease, box-shadow .2s ease; }
.mode-toggle-basic { background:linear-gradient(135deg, #0f766e 0%, #34d399 100%); color:#f8fafc; box-shadow:0 18rpx 40rpx rgba(52,211,153,0.32); }
.mode-toggle-pro { background:linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%); color:#f8fafc; box-shadow:0 18rpx 40rpx rgba(56,189,248,0.32); }
.mode-toggle-btn:active { transform:translateY(-4rpx) scale(1.01); }
.deck-toggle-btn {
  width:100%;
  padding:26rpx 36rpx;
  white-space:normal;
  word-wrap: break-word;
  font-weight:800;
  border:2rpx solid rgba(14,165,233,0.45);
  color:#0f172a;
  background:linear-gradient(135deg, rgba(224,242,254,0.96), rgba(191,219,254,0.96));
  box-shadow:0 16rpx 38rpx rgba(14,165,233,0.28);
}

.timer-cell { cursor: pointer; }
.timer-popover-layer { position:fixed; inset:0; z-index:998; background:rgba(15,23,42,0.35); backdrop-filter:blur(12rpx); animation: overlay-fade 0.3s ease forwards; }
.timer-popover { position:absolute; background:linear-gradient(135deg, rgba(248,250,255,0.96), rgba(224,242,254,0.92)); padding:24rpx 34rpx; border-radius:24rpx; box-shadow:0 20rpx 48rpx rgba(15,23,42,0.25); transform:translate(-50%, 0); display:flex; flex-direction:column; gap:16rpx; border:2rpx solid rgba(148,197,253,0.45); animation: popover-pop 0.35s ease-out forwards; overflow:hidden; }
.timer-popover::before { content:''; position:absolute; inset:-30%; background:radial-gradient(circle at 50% 0%, rgba(59,130,246,0.32), transparent 60%), radial-gradient(circle at 0% 100%, rgba(34,197,94,0.25), transparent 60%); filter: blur(60rpx); opacity:0.7; pointer-events:none; }
.timer-popover-item { border:none; border-radius:16rpx; padding:18rpx 36rpx; background:linear-gradient(135deg, rgba(254,226,226,0.96), rgba(252,165,165,0.9)); color:#7f1d1d; font-size:28rpx; font-weight:800; box-shadow:0 14rpx 32rpx rgba(248,113,113,0.28); border:2rpx solid rgba(248,113,113,0.4); text-shadow:0 3rpx 8rpx rgba(248,113,113,0.35); transition: transform .2s ease, box-shadow .2s ease; }
.timer-popover-item:active { transform:translateY(-4rpx) scale(1.01); box-shadow:0 18rpx 36rpx rgba(248,113,113,0.35); }

.floating-hint-layer{ position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:999 }
.floating-hint-layer.interactive{ pointer-events:auto }
.floating-hint{ max-width:70%; background:rgba(15,23,42,0.86); color:#fff; padding:24rpx 36rpx; border-radius:24rpx; text-align:center; font-size:30rpx; box-shadow:0 20rpx 48rpx rgba(15,23,42,0.25); backdrop-filter:blur(12px) }

.btn { border:2rpx solid rgba(148,197,253,0.38); border-radius:18rpx; padding:28rpx 0; font-size:32rpx; line-height:1; box-shadow:0 12rpx 28rpx rgba(15,23,42,.1); width:100%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; background:linear-gradient(135deg, rgba(248,250,255,0.96), rgba(236,252,255,0.92)); color:#0f172a; font-weight:700; transition: transform .2s ease, box-shadow .2s ease; }
.btn:active { transform:translateY(-4rpx) scale(1.01); box-shadow:0 18rpx 36rpx rgba(15,23,42,0.18); }
.btn-operator { background:linear-gradient(135deg, rgba(236,252,255,0.98), rgba(219,234,254,0.94)); color:#1d4ed8; border:2rpx solid rgba(148,197,253,0.55); font-size:64rpx;font-weight: 800; box-shadow:0 14rpx 32rpx rgba(59,130,246,0.22); text-shadow:0 4rpx 12rpx rgba(148,197,253,0.4); }
.btn-operator:active { transform:translateY(-6rpx) scale(1.02); box-shadow:0 22rpx 44rpx rgba(59,130,246,0.32); }
.btn-primary { background:linear-gradient(135deg, #0f766e 0%, #34d399 100%); color:#f8fafc; border-color:transparent; box-shadow:0 18rpx 44rpx rgba(16,185,129,0.28); }
/* 使用全局 .btn-secondary 样式（uni.scss）以保持一致性 */

/* 成功动画覆盖层 */
.success-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; background:radial-gradient(circle at center, rgba(59,130,246,0.16), transparent 65%); animation: overlay-fade 0.35s ease forwards; }
.success-burst { position:relative; background:linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.9)); color:#f8fafc; font-weight:800; font-size:64rpx; padding:40rpx 68rpx; border-radius:9999rpx; box-shadow:0 18rpx 48rpx rgba(16,185,129,0.35), 0 0 0 2rpx rgba(255,255,255,0.5); text-shadow:0 6rpx 14rpx rgba(15,23,42,0.35); overflow:hidden; animation: success-pop .5s ease-out both; }
.success-burst::before { content:''; position:absolute; inset:-45%; background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.45), transparent 60%); filter: blur(50rpx); opacity:0.7; animation: burst-aurora 1.6s ease-in-out infinite; }
.success-burst::after { content:''; position:absolute; inset:-20%; background:radial-gradient(circle at 10% 50%, rgba(255,255,255,0.45), transparent 55%), radial-gradient(circle at 90% 50%, rgba(34,197,94,0.45), transparent 60%); mix-blend-mode: screen; opacity:0.6; animation: particle-spin 1.2s linear infinite; }
.error-burst { position:relative; background:linear-gradient(135deg, rgba(239,68,68,0.94), rgba(244,114,182,0.9)); color:#fff; font-weight:800; font-size:48rpx; padding:34rpx 52rpx; border-radius:9999rpx; box-shadow:0 18rpx 48rpx rgba(244,114,182,0.32), 0 0 0 2rpx rgba(255,255,255,0.4); animation: success-pop .5s ease-out both; display:flex; flex-direction:column; align-items:center; gap:8rpx; overflow:hidden; text-shadow:0 6rpx 16rpx rgba(15,23,42,0.35); }
.error-burst::before { content:''; position:absolute; inset:-40%; background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4), transparent 60%); filter: blur(46rpx); opacity:0.7; animation: burst-aurora 1.4s ease-in-out infinite reverse; }
.error-burst::after { content:''; position:absolute; inset:-18%; background:radial-gradient(circle at 15% 50%, rgba(248,113,113,0.5), transparent 55%), radial-gradient(circle at 85% 45%, rgba(244,114,182,0.5), transparent 60%); mix-blend-mode: screen; opacity:0.6; animation: particle-spin 1.1s linear infinite reverse; }
.error-burst .err-title{ font-size:48rpx; font-weight:800 }
.error-burst .err-val{ font-size:28rpx; font-weight:700; opacity:.95 }
@keyframes success-pop { 0% { transform: scale(.6); opacity: 0; } 50% { transform: scale(1.08); opacity: 1; } 100% { transform:scale(1); opacity: 1; } }

/* 表达式区 */
.expr-card { padding:42rpx 34rpx 40rpx; border:none; background:transparent; box-shadow:none; }
.expr-card .panel-badge { top: 26rpx; }
.expr-card-body { margin-top:32rpx; }
.expr-zone {
  --tok-card-h: 112rpx;
  --card-w-ratio: 0.714;
  background: linear-gradient(135deg, rgba(241, 248, 255, 0.96) 0%, rgba(224, 242, 254, 0.92) 50%, rgba(219, 234, 254, 0.9) 100%);
  border:2rpx solid rgba(148,197,253,0.55);
  border-radius:32rpx;
  padding:32rpx;
  overflow:hidden;
  position:relative;
  box-shadow:0 22rpx 48rpx rgba(15,23,42,0.22), inset 0 0 0 2rpx rgba(255,255,255,0.6);
  transition: box-shadow .28s ease, border-color .28s ease, transform .28s ease;
}
.expr-zone::before {
  content:'';
  position:absolute;
  inset:-40%;
  background:conic-gradient(from 45deg, rgba(56,189,248,0.3), rgba(59,130,246,0.28), rgba(14,165,233,0.32), rgba(56,189,248,0.3));
  filter: blur(90rpx);
  opacity:0;
  transition: opacity .28s ease;
  pointer-events:none;
}
.expr-zone-active { border-color:rgba(59,130,246,0.65); box-shadow:0 32rpx 64rpx rgba(59,130,246,0.28), inset 0 0 0 2rpx rgba(255,255,255,0.75); }
.expr-zone-active::before { opacity:0.75; }
.expr-override {
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  text-align:center;
  padding:0 32rpx;
  color:#0f172a;
  font-size:30rpx;
  font-weight:800;
  background:rgba(248,250,255,0.9);
  pointer-events:none;
  z-index:2;
}
.expr-row { display:inline-flex; flex-wrap:nowrap; white-space:nowrap; gap:14rpx; align-items:center; position:relative; z-index:3; }
.expr-zone.empty::after {
  content: "表达式区域";
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  pointer-events:none;
  color:rgba(30,64,175,0.35);
  font-size:26rpx;
  letter-spacing:2rpx;
  text-transform:uppercase;
  animation: placeholder-fade 1.4s ease-in-out infinite alternate;
}
.tok { color:#0f172a; border-radius:18rpx; transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease; box-shadow:0 12rpx 28rpx rgba(15,23,42,0.18); position:relative; }
.tok.num { padding:0; border:none; background:transparent; width: calc(var(--tok-card-h) * var(--card-w-ratio)); height: var(--tok-card-h); display:inline-block; }
.tok-card-img { width:100%; height:100%; object-fit: contain; display:block; border-radius:18rpx; box-shadow:0 12rpx 28rpx rgba(15,23,42,0.18); }
.tok.op { height: var(--tok-card-h); width: calc(var(--tok-card-h) * var(--card-w-ratio) / 2); padding: 0; font-size: calc(var(--tok-card-h) * 0.44); font-weight:800; background:linear-gradient(135deg, rgba(224,242,254,0.95), rgba(191,219,254,0.9)); border:2rpx solid rgba(148,197,253,0.6); display:flex; align-items:center; justify-content:center; box-shadow:0 14rpx 32rpx rgba(59,130,246,0.26); box-sizing: border-box; color:#1d4ed8; text-shadow:0 4rpx 12rpx rgba(148,197,253,0.4); }
.tok.dragging { opacity:.65; box-shadow:0 18rpx 36rpx rgba(59,130,246,0.38); transform:scale(1.05); }
.tok.just-inserted { animation: pop-in 220ms ease-out; }
.insert-placeholder { border-radius:18rpx; border:2rpx solid rgba(59,130,246,0.45); background:linear-gradient(135deg, rgba(191,219,254,0.35), rgba(125,211,252,0.35)); opacity:1; position:relative; overflow:hidden; animation: placeholder-pulse 1.4s ease-in-out infinite; }
.insert-placeholder.num { min-width: calc(var(--tok-card-h) * var(--card-w-ratio)); min-height: var(--tok-card-h); margin:2rpx; }
.insert-placeholder.op { min-width: calc(var(--tok-card-h) * var(--card-w-ratio) / 2); min-height: var(--tok-card-h); margin:2rpx; }
.insert-placeholder::before { content:''; position:absolute; inset:-40% 0; background:linear-gradient(120deg, rgba(59,130,246,0.28), rgba(125,211,252,0.32), rgba(59,130,246,0.28)); filter: blur(50rpx); opacity:0.85; animation: shimmer 1.2s linear infinite; }
.drag-ghost { position:fixed; z-index:9999; background:linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.9)); color:#f8fafc; padding:18rpx 26rpx; border-radius:16rpx; font-size:32rpx; font-weight:800; border:2rpx solid rgba(255,255,255,0.65); pointer-events:none; box-shadow:0 18rpx 36rpx rgba(59,130,246,0.42); text-shadow:0 4rpx 12rpx rgba(15,23,42,0.35); animation: ghost-glow 1.4s ease-in-out infinite; }

/* 统计：单行紧凑 */
.stats-card { padding: 46rpx 34rpx 32rpx; border:none; background:transparent; box-shadow:none; }
.stats-card .panel-badge { top: 24rpx; }
.stats-compact-table { margin-top: 34rpx; display:grid; grid-template-rows:auto auto; row-gap:16rpx; padding:24rpx 26rpx; border-radius:26rpx; background:rgba(255,255,255,0.92); border:2rpx solid rgba(148,197,253,0.45); box-shadow:0 18rpx 42rpx rgba(15,23,42,0.18); backdrop-filter: blur(18rpx); }
.stats-compact-table .thead, .stats-compact-table .tbody { display:grid; grid-template-columns: repeat(7, 1fr); align-items:center; column-gap:18rpx; }
.stats-compact-table .thead { color:#0f172a; font-weight:800; font-size:26rpx; text-align: center; text-shadow:0 4rpx 12rpx rgba(148,197,253,0.32); letter-spacing:2rpx; }
.stats-compact-table .tbody { font-size:30rpx; text-align: center; color:#0f172a; font-weight:700; }
.stats-compact-table .td { display:flex; align-items:center; justify-content:center; padding:12rpx 0; border-radius:18rpx; background:linear-gradient(180deg, rgba(244,247,255,0.96), rgba(224,242,254,0.92)); box-shadow: inset 0 0 0 2rpx rgba(148,197,253,0.32); }
.stats-compact-table .ok { color:#16a34a; font-weight:800; text-shadow:0 0 12rpx rgba(34,197,94,0.28); }
.stats-compact-table .fail { color:#dc2626; font-weight:800; text-shadow:0 0 12rpx rgba(248,113,113,0.35); }
.stats-one-line .stats-item { display:flex; align-items:center; gap:6rpx; padding:4rpx 8rpx; border-right:2rpx solid rgba(148,197,253,0.45); }
.stats-one-line .stats-item:last-child { border-right:none; }
.stat-label { color:#1f2937; font-size:26rpx; }
.stat-label.ok, .stat-value.ok { color:#16a34a; font-weight:700 }
.stat-label.fail, .stat-value.fail { color:#dc2626; font-weight:700 }
.stat-value { font-weight:700; color:#111827; font-size:28rpx; }

.btn-reshuffle { padding: 12rpx 0; font-size: 26rpx; line-height: 1; }

.basic-mode { display:flex; flex-direction:column; gap:24rpx; }
.basic-board { display:flex; gap:24rpx; align-items:stretch; justify-content:center; }
.basic-column { display:flex; flex-direction:column; gap:24rpx; flex:1; }
.basic-card-wrapper { flex:1; }
.basic-card { background:None; border-radius:8rpx; box-shadow:0 12rpx 28rpx rgba(15,23,42,.12); border:2rpx solid transparent; overflow:hidden; position:relative; display:flex; align-items:center; justify-content:center; min-height:320rpx; transition:border-color 0.2s ease, box-shadow 0.2s ease; }
.basic-card.hidden { visibility:hidden; pointer-events:none; }
.basic-card.selected { border-color:#145751; box-shadow:0 16rpx 32rpx rgba(20,87,81,.22); }
.basic-card.result { background:#fef3c7; }
.basic-card-img { width:100%; height:100%; object-fit:contain; }
.basic-card-value { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, #fefce8 0%, #fde68a 100%); }
.basic-card-value-text { font-size:72rpx; font-weight:700; color:#1f2937; }
.basic-ops { display:flex; flex-direction:column; gap:20rpx; align-items:stretch; justify-content:center; flex:0 0 160rpx; }
.basic-ops .btn-operator { height:110rpx; font-size:64rpx; }
.basic-ops .btn-operator.active { background:linear-gradient(135deg, #1d4ed8 0%, #38bdf8 100%); color:#fff; border-color:transparent; box-shadow:0 18rpx 44rpx rgba(59,130,246,0.32); }
.basic-face-toggle { margin-top:12rpx; white-space:normal;word-break: break-all;}
.basic-actions { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.basic-actions .btn[disabled] { opacity:.6; }

@keyframes bg-drift { 0% { transform: rotate(0deg) scale(1); opacity:0.75; } 50% { transform: rotate(180deg) scale(1.05); opacity:0.85; } 100% { transform: rotate(360deg) scale(1); opacity:0.75; } }
@keyframes card-float { 0% { transform: translateY(0); } 50% { transform: translateY(-8rpx); } 100% { transform: translateY(0); } }
@keyframes placeholder-fade { 0% { opacity:0.6; } 100% { opacity:0.95; } }
@keyframes placeholder-pulse { 0% { transform:scale(0.96); opacity:0.7; } 50% { transform:scale(1.02); opacity:1; } 100% { transform:scale(0.96); opacity:0.7; } }
@keyframes ghost-glow { 0%, 100% { box-shadow:0 18rpx 36rpx rgba(59,130,246,0.42); } 50% { box-shadow:0 24rpx 48rpx rgba(59,130,246,0.55); } }
@keyframes burst-aurora { 0% { transform: rotate(0deg) scale(1); } 100% { transform: rotate(360deg) scale(1.05); } }
@keyframes particle-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
@keyframes overlay-fade { from { opacity:0; } to { opacity:1; } }
@keyframes popover-pop { 0% { opacity:0; transform: translate(-50%, 12rpx) scale(0.9); } 100% { opacity:1; transform: translate(-50%, 0) scale(1); } }
@keyframes pop-in { from { transform:scale(0.85); opacity:.2; } to { transform:scale(1); opacity:1; } }
@keyframes shimmer { from { background-position-x:0%; } to { background-position-x:200%; } }
@keyframes page-fade-in { from { opacity: 0; } to { opacity: 1; } }
</style>
