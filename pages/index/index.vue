<template>
  <view class="page col" style="padding: 24rpx; padding-bottom: 200rpx; gap: 24rpx; position: relative;">

    <!-- 牌区：四张卡片等宽占满一行（每张卡片单独计数） -->
    <view class="col" style="gap: 12rpx;">
      <text style="font-size: 28rpx; font-weight: 600;">将四张牌拖到表达式区域</text>
      <view class="cards-row">
        <view v-for="(card, idx) in cards" :key="idx"
              class="card-num"
              :class="{ used: (usedByCard[idx]||0) > 0 }"
              @touchstart.stop.prevent="startDrag({ type: 'num', value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event)"
              @touchmove.stop.prevent="onDrag($event)"
              @touchend.stop.prevent="endDrag()">
          <image class="card-img" :src="cardImage(card)" mode="widthFix"/>
        </view>
      </view>
    </view>

    <!-- 运算符区：六个运算符单行平铺等宽 -->
    <view class="col" style="gap: 12rpx;">
      <text style="font-size: 28rpx; font-weight: 600;">拖拽运算符</text>
      <view class="ops-row">
        <view v-for="op in ops" :key="op" class="op-chip"
              @touchstart.stop.prevent="startDrag({ type: 'op', value: op }, $event)"
              @touchmove.stop.prevent="onDrag($event)"
              @touchend.stop.prevent="endDrag()">{{ op }}</view>
      </view>
    </view>
 
    <view class="actions-row" style="align-items:center; gap: 12rpx; margin-top: 8rpx;">
      <button class="btn outlined mode-btn" @click="toggleFaceMode">{{ faceUseHigh ? 'J/Q/K=11/12/13' : 'J/Q/K=1' }}</button>
      <button class="btn outlined" @click="refresh">换题</button>
      <button class="btn outlined" @click="clearAll">重写</button>
    </view>

    <!-- 表达式拖拽接收区（横向显示，必要时换行）；token 卡片可拖动重排；拖出该区域即撤销 -->
    <view id="exprZone" class="expr-zone" :class="{ 'expr-zone-active': drag.active }">
      <text v-if="tokens.length === 0" style="color:#999;">将卡牌和运算符拖到这里组成表达式</text>
      <view class="row expr-row">
        <block v-for="(t, i) in tokens" :key="i">
          <view v-if="dragInsertIndex === i" class="insert-placeholder" :class="placeholderSizeClass"></view>
          <view class="tok" :class="[ (t.type === 'num' ? 'num' : 'op'), { 'just-inserted': i === lastInsertedIndex, 'dragging': drag.token && drag.token.type==='tok' && drag.token.index===i } ]"
                @touchstart.stop.prevent="startDrag({ type: 'tok', index: i, value: t.value }, $event)"
                @touchmove.stop.prevent="onDrag($event)"
                @touchend.stop.prevent="endDrag()">{{ t.type === 'num' ? labelFor(t.rank || +t.value) : t.value }}</view>
        </block>
        <view v-if="dragInsertIndex === tokens.length" class="insert-placeholder" :class="placeholderSizeClass"></view>
      </view>
      <view style="margin-top: 12rpx; color:#666; font-size: 26rpx;">
        <text>当前：</text>
        <text v-if="currentText">{{ currentText }}</text>
        <text v-else>未完成</text>
      </view>
    </view>

    <!-- 操作按钮（单行展示） -->

    <text style="font-size: 28rpx; color: #333;">{{ feedback }}</text>

    <!-- 拖拽中的浮层 -->
    <view v-if="drag.active" class="drag-ghost" :style="ghostStyle">{{ ghostText }}</view>

    <!-- 底部固定提交/答案按钮 -->
    <view class="bottom-bar">
      <view class="bottom-bar-inner">
        <button class="btn primary" @click="check">提交</button>
        <button class="btn outlined light" @click="showSolution">答案</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance, computed } from 'vue'
import { evaluateExprToFraction, solve24 } from '../../utils/solver.js'

const cards = ref([{ rank:1, suit:'S' }, { rank:5, suit:'H' }, { rank:5, suit:'D' }, { rank:5, suit:'C' }])
const solution = ref(null)
const feedback = ref('')
const usedByCard = ref([0,0,0,0])
const tokens = ref([])
const ops = ['+','-','×','÷','(',')']
const faceUseHigh = ref(false)

const drag = ref({ active: false, token: null, x: 0, y: 0, startX: 0, startY: 0, moved: false })
const exprBox = ref({ left: 0, top: 0, right: 0, bottom: 0 })
const tokRects = ref([])
const dragInsertIndex = ref(-1)
const lastInsertedIndex = ref(-1)
const { proxy } = getCurrentInstance()

const expr = computed(() => tokens.value.map(x => x.type==='num' ? String(evalRank(x.rank)) : x.value).join(''))
const ghostStyle = computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`)
const ghostText = computed(() => {
  const t = drag.value.token
  if (!t) return ''
  if (t.type === 'num') return labelFor(t.rank || +t.value)
  if (t.type === 'tok') return isNumToken(t.value) ? labelFor(+t.value) : t.value
  return t.value || ''
})
const isNumToken = (t) => /^(10|11|12|13|[1-9])$/.test(t)
const placeholderSizeClass = computed(() => {
  const dt = drag.value.token
  if (!drag.value.active || !dt) return 'op'
  if (dt.type === 'num') return 'num'
  if (dt.type === 'op') return 'op'
  if (dt.type === 'tok') return isNumToken(dt.value) ? 'num' : 'op'
  return 'op'
})

const currentText = computed(() => {
  const s = expr.value
  if (!s) return ''
  const v = evaluateExprToFraction(s)
  return v ? `${v.toString()}` : ''
})

function refresh() {
  // generate solvable set according to current face mode
  const { nums, sol } = generateSolvableWithMode()
  // assign random suits for visual variety
  cards.value = nums.map(n => ({ rank: n, suit: randomSuit() }))
  solution.value = sol
  tokens.value = []
  feedback.value = '出题完成：请用四张牌 + - × ÷ ( ) 算出 24'
  usedByCard.value = [0,0,0,0]
}

onMounted(() => { refresh() })

function clearAll() { tokens.value = []; usedByCard.value = [0,0,0,0] }

function check() {
  const usedCount = usedByCard.value.reduce((a,b)=>a+(b?1:0),0)
  if (usedCount !== 4) { feedback.value = '表达式未正确使用四张牌（每张各一次）'; return }
  const s = expr.value
  const v = evaluateExprToFraction(s)
  feedback.value = (v && v.equalsInt && v.equalsInt(24)) ? '正确！恭喜你算出 24' : '结果不是 24，请再试试～'
}

function showSolution() { feedback.value = solution.value ? ('提示：' + solution.value) : '暂无提示' }

function toggleFaceMode() {
  faceUseHigh.value = !faceUseHigh.value
}

// 拖拽相关
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
  // 实时重排/占位
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
  if (token && token.type === 'tok') {
    if (!drag.value.moved) {
      // 点击不移动
    } else if (inExpr) {
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

function tryAppendToken(token) {
  tryInsertTokenAt(token, tokens.value.length)
}

function tryInsertTokenAt(token, to) {
  const clamped = Math.max(0, Math.min(to, tokens.value.length))
  if (token.type === 'num') {
    const ci = token.cardIndex
    if (ci == null) { feedback.value = '该卡片信息缺失'; return }
    if ((usedByCard.value[ci] || 0) >= 1) { feedback.value = '该卡片已用过'; return }
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
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e.detail || { x: 0, y: 0 }
  return { x: t.clientX ?? t.x ?? 0, y: t.clientY ?? t.y ?? 0 }
}

// removed duplicate labelFor (kept single definition below)

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
  // Use /static path so HBuilderX packs assets into APK
  return `/static/cards/${suitName}${rankName}.png`
}
function randomSuit() { return ['S','H','D','C'][Math.floor(Math.random()*4)] }
function generateSolvableWithMode() {
  while (true) {
    const raw = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13))
    const mapped = raw.map(r => evalRank(r))
    const sol = solve24(mapped)
    if (sol) return { nums: raw, sol }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: linear-gradient(180deg,#4f8bff 0%, #1f5bd8 100%); display:flex; flex-direction: column; }
.cards-row { display:flex; justify-content: space-between; align-items: stretch; }
.card-num { width: 24%; background:#fff; border:2rpx solid #ddd; border-radius: 16rpx; padding: 16rpx; display:flex; flex-direction:column; align-items:center; color:#222; }
.card-num.used { background:#3a7afe; border-color:#3a7afe; color:#fff; }
.card-num.used .card-img { filter: invert(1) hue-rotate(180deg); }
.card-img { width: 100%; height: auto; border-radius: 12rpx; }
.card-num-text { font-size: 40rpx; font-weight: 700; }
.ops-row { display:flex; justify-content: space-between; align-items:center; }
.ops-row .op-chip { width: 15%; text-align:center; }
.op-chip { background:#fff; border:2rpx solid #ddd; border-radius: 10rpx; padding: 16rpx 24rpx; font-size: 32rpx; }
.expr-zone { background:#fff; border:2rpx dashed #bbb; border-radius: 12rpx; padding: 24rpx; min-height: 160rpx; flex: 1; overflow: auto; }
.expr-zone-active { border-color:#3a7afe; }
.expr-row { display:flex; flex-wrap: wrap; gap: 12rpx; }
.tok { background:#f2f6ff; color:#1f3a93; border:2rpx solid #3a7afe22; border-radius: 10rpx; transition: transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease; }
.tok.num { padding: 32rpx 44rpx; font-size: 68rpx; font-weight: 700; }
.tok.op { padding: 8rpx 14rpx; font-size: 26rpx; }
.tok.dragging { opacity: .6; box-shadow: 0 6rpx 24rpx rgba(0,0,0,.18); }
.tok.just-inserted { animation: pop-in 200ms ease-out; }
.insert-placeholder { border-radius: 10rpx; border:2rpx dashed #3a7afe; background: #eaf1ff; opacity: .9; position: relative; overflow: hidden; }
.insert-placeholder.num { min-width: 160rpx; min-height: 112rpx; margin: 2rpx; }
.insert-placeholder.op { min-width: 60rpx; min-height: 42rpx; margin: 2rpx; }
.insert-placeholder::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(60deg, rgba(58,122,254,0.05) 0, rgba(58,122,254,0.05) 8rpx, rgba(58,122,254,0.18) 8rpx, rgba(58,122,254,0.18) 16rpx); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
.actions-row { display:flex; gap: 16rpx; justify-content: space-between; align-items:center; flex-wrap: nowrap; }
.drag-ghost { position: fixed; z-index: 9999; background:#3a7afe; color:#fff; padding: 16rpx 22rpx; border-radius: 10rpx; font-size: 32rpx; pointer-events:none; }

/* 底部固定条 */
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; padding: 12rpx 24rpx calc(12rpx + constant(safe-area-inset-bottom)); padding-bottom: calc(12rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.96); box-shadow: 0 -6rpx 20rpx rgba(0,0,0,.08); }
.bottom-bar-inner { display:flex; gap: 16rpx; justify-content: space-between; align-items:center; }
.btn.primary { background:#1f5bd8; color:#fff; border-color:#1f5bd8; }
.btn.outlined.light { background: transparent; color:#1f5bd8; border-color:#1f5bd8; }
.mode-btn { min-width: 260rpx; text-align: center; white-space: nowrap; }

@keyframes pop-in { from { transform: scale(0.85); opacity: .2; } to { transform: scale(1); opacity: 1; } }
@keyframes shimmer { from { background-position-x: 0%; } to { background-position-x: 200%; } }
</style>
