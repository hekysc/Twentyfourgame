<template>
  <view class="page col" :class="{ booted }" style="padding: 24rpx; padding-top: 24rpx; gap: 24rpx; position: relative;">

    <!-- 牌区：四张卡片等宽占满一行（每张卡片单独计数） -->
    <view id="cardGrid" class="card-grid" style="padding-top: 50rpx;">
      <view v-for="(card, idx) in cards" :key="idx"
            class="card"
            :class="{ used: (usedByCard[idx]||0) > 0 }"
            @touchstart.stop.prevent="startDrag({ type: 'num', value: String(card.rank), rank: card.rank, suit: card.suit, cardIndex: idx }, $event)"
            @touchmove.stop.prevent="onDrag($event)"
            @touchend.stop.prevent="endDrag()">
        <image class="card-img" :src="cardImage(card)" mode="widthFix"/>
      </view>
    </view>

    <!-- 表达式卡片容器 -->
    <view class="expr-card">
      <view class="expr-title">当前表达式：<text class="status-text">{{ currentText ? currentText : '未完成' }}</text></view>
      <view id="exprZone" class="expr-zone" :class="{ 'expr-zone-active': drag.active }" :style="{ height: exprZoneHeight + 'px' }">
        <view v-if="tokens.length === 0" class="expr-placeholder">将卡牌和运算符拖到这里</view>
        <view id="exprRow" class="row expr-row" :style="{ transform: `scale(${exprScale})`, transformOrigin: 'left center' }">
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
    <text id="hintText" class="hint-text">{{ feedback || '请用四张牌和运算符算出 24' }}</text>

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

    <!-- 提交 与 重写：各占一半宽度 -->
    <view id="submitRow" class="pair-grid">
      <button class="btn btn-primary" @click="check">提交答案</button>
      <button class="btn btn-primary" @click="clearAll">清空表达式</button>
    </view>

    <!-- 底部固定提交/答案按钮 -->
    <view id="bottomBar" class="bottom-bar">
      <view class="bottom-bar-inner bottom-nav">
        <view class="bottom-item" @click="showSolution">
          <text class="bottom-icon">💡</text>
          <text class="bottom-label">答案</text>
        </view>
        <view class="bottom-item" @click="refresh">
          <text class="bottom-icon">▶️</text>
          <text class="bottom-label">换题</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance, computed, watch, nextTick } from 'vue'
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

// 启动动画
const booted = ref(false)

const expr = computed(() => tokens.value.map(x => x.type==='num' ? String(evalRank(x.rank)) : x.value).join(''))
const ghostStyle = computed(() => `left:${drag.value.x}px; top:${drag.value.y}px;`)
const exprScale = ref(1)
// const exprZoneHeight = ref(200)
const opsDensity = ref('normal') // normal | compact | tight
const opsDensityClass = computed(() => opsDensity.value === 'tight' ? 'ops-tight' : (opsDensity.value === 'compact' ? 'ops-compact' : ''))
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
  nextTick(() => recomputeExprHeight())
}

onMounted(() => {
  refresh()
  // 启动动画触发
  setTimeout(() => { booted.value = true }, 0)
  // 初始计算表达式高度
  nextTick(() => { updateVHVar(); recomputeExprHeight() })
})

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
const lastTap = ref({ time: 0, key: '' })
function tapKeyFor(token) {
  if (!token) return ''
  if (token.type === 'num' && token.cardIndex != null) return `num-${token.cardIndex}`
  if (token.type === 'op') return `op-${token.value}`
  if (token.type === 'tok') return `tok-${token.index}`
  return `${token.type}-${token.value || ''}`
}

function endDrag() {
  if (!drag.value.active) return
  const x = drag.value.x, y = drag.value.y
  const token = drag.value.token
  const inExpr = inside(exprBox.value, x, y)
  // 处理双击：候选区双击追加，表达式内双击移除
  if (token && !drag.value.moved) {
    const now = Date.now()
    const key = tapKeyFor(token)
    if (now - (lastTap.value.time || 0) < 300 && lastTap.value.key === key) {
      // 双击生效
      if (token.type === 'tok') {
        removeTokenAt(token.index)
      } else if (token.type === 'num' || token.type === 'op') {
        tryAppendToken(token)
        lastInsertedIndex.value = Math.max(0, tokens.value.length - 1)
        setTimeout(() => { lastInsertedIndex.value = -1 }, 220)
      }
      lastTap.value = { time: 0, key: '' }
      drag.value.active = false
      drag.value.token = null
      dragInsertIndex.value = -1
      return
    } else {
      lastTap.value = { time: now, key }
      // 单击不做操作，直接收尾
      drag.value.active = false
      drag.value.token = null
      dragInsertIndex.value = -1
      return
    }
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

onMounted(() => {
  updateExprScale()
  if (uni.onWindowResize) uni.onWindowResize(() => { updateVHVar(); updateExprScale(); recomputeExprHeight() })
})

watch(tokens, () => updateExprScale())

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

// 以 JS 方式设置 --vh，兼容不支持 dvh 的 Android/iOS WebView
function updateVHVar() {
  try {
    const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
    const h = sys.windowHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
    if (h) document.documentElement && document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px')
  } catch (e) { /* noop */ }
}

// 计算表达式区域可用高度，确保整页一屏显示
function recomputeExprHeight() {
  const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
  const winH = sys.windowHeight || sys.screenHeight || 0
  // 根据屏幕高度自适应运算符尺寸（阈值可调）
  if (winH && winH < 640) opsDensity.value = 'tight'
  else if (winH && winH < 740) opsDensity.value = 'compact'
  else opsDensity.value = 'normal'
  // 等待密度类应用后再测量
  nextTick(() => {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#exprZone').boundingClientRect()
     .select('#bottomBar').boundingClientRect()
     .exec(res => {
       const [exprRect, bottomRect] = res || []
       if (!exprRect) return
       const bottomTop = bottomRect && bottomRect.top ? bottomRect.top : winH
       let avail = bottomTop - exprRect.top - 16 // 留出底部空隙
       if (!isFinite(avail) || avail <= 0) avail = 120
       // 限制下限，避免过小
       exprZoneHeight.value = Math.max(120, Math.floor(avail))
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
.page { min-height: calc(var(--vh, 1vh) * 90); background: linear-gradient(180deg, #f7f9ff 0%, #a7ceff 100%); display:flex; flex-direction: column; }
.page { opacity: 0; }
.page.booted { animation: page-fade-in .28s ease-out forwards; }
.topbar { position: sticky; top: 0; z-index: 10; padding: 18rpx 0; background: rgba(255,255,255,0.88); backdrop-filter: blur(6rpx); border-bottom: 2rpx solid #e5e7eb; }
.topbar-title { font-size: 36rpx; font-weight: 700; color:#1f2937; text-align:center; width:100%; display:block; }

/* 卡牌区域 */
.card-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.card { background:#fff; border-radius:28rpx; overflow:hidden; box-shadow:0 12rpx 28rpx rgba(15,23,42,.08); }
.card.used { filter: grayscale(1) saturate(.2); opacity:.5; }
.card-img { width:100%; height:auto; display:block; }

/* 运算符与控制区 */
.operator-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.ops-row-1 { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.ops-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:18rpx; align-items:stretch; }
.ops-left { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.controls-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.pair-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:18rpx; }
.span-2 { grid-column: span 2 / auto; }
.placeholder-cell { height:0; }
.mode-btn { width: 100%; 
  white-space: nowrap; 
}

/* 通用按钮 */
.btn { border:none; border-radius:20rpx; padding:28rpx 0; font-size:34rpx; line-height:1; box-shadow:0 10rpx 24rpx rgba(15,23,42,.06); width:100%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
.btn-operator { background:#fff; color:#2563eb; border:2rpx solid #e5e7eb; }
.btn-primary { background:#145751; color:#fff; }
.btn-secondary { 
  color:#0f172a; 
  background: linear-gradient(to bottom, #f8fafc, #0961d3);
  box-shadow: 
  0 10px 12px rgba(0, 0, 0, 0.1),   /* 外阴影：按钮悬浮感 */
  inset 0 1px 2px rgba(255, 255, 255, 0.6); /* 内阴影：高光 */
  border-radius: 0.5rem;  
  transition: all 0.2s ease-in-out;
}
.full { width:100%; }

/* 运算符自适应密度（根据屏幕高度切换） */
.ops-compact .btn-operator, .ops-compact .mode-btn { padding:22rpx 0; font-size:30rpx; }
.ops-compact.ops-row-1, .ops-compact.ops-row-2, .ops-compact .ops-left { gap:14rpx; }
.ops-tight .btn-operator, .ops-tight .mode-btn { padding:18rpx 0; font-size:26rpx; }
.ops-tight.ops-row-1, .ops-tight.ops-row-2, .ops-tight .ops-left { gap:10rpx; }

/* 表达式区域 */
.expr-card { background:#fff; padding:24rpx; border-radius:28rpx; box-shadow:0 6rpx 20rpx rgba(0,0,0,.06); }
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

/* 轻提示 */
.hint-text { font-size: 28rpx; color:#6b7280; text-align:center; }

/* 底部固定条 */
.bottom-bar { position:fixed; left:0; right:0; bottom:0; padding:12rpx 24rpx 12rpx; background:rgba(255,255,255,0.96); box-shadow:0 -6rpx 20rpx rgba(0,0,0,.08); }
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bottom-bar { padding-bottom: calc(12rpx + env(safe-area-inset-bottom)); }
}
@supports (padding-bottom: constant(safe-area-inset-bottom)) {
  .bottom-bar { padding-bottom: calc(12rpx + constant(safe-area-inset-bottom)); }
}
.bottom-bar-inner { display:flex; gap:16rpx; justify-content:space-between; align-items:center; }
.bottom-nav { justify-content: space-around; gap: 0; }
.bottom-item { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8rpx 12rpx; color:#6b7280; }
.bottom-item:active { transform: scale(0.98); }
.bottom-icon { font-size:44rpx; line-height:1; color:#6b7280; }
.bottom-label { font-size:24rpx; color:#6b7280; margin-top:6rpx; }

@keyframes pop-in { from { transform:scale(0.85); opacity:.2; } to { transform:scale(1); opacity:1; } }
@keyframes shimmer { from { background-position-x:0%; } to { background-position-x:200%; } }
@keyframes page-fade-in { from { opacity: 0; } to { opacity: 1; } }
/* 支持动态视口单位的浏览器使用 100dvh，更贴合 Android/iOS 可见高度 */
/* @supports (min-height: 100dvh) { */
  /* .page { min-height: 100dvh; } */
/* } */
</style>
