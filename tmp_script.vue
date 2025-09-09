
<script setup>
import { ref, onMounted, getCurrentInstance, computed, watch, nextTick } from 'vue'
import { evaluateExprToFraction, solve24 } from '../../utils/solver.js'
import { ensureInit, getCurrentUser, pushRound } from '../../utils/store.js'

const cards = ref([{ rank:1, suit:'S' }, { rank:5, suit:'H' }, { rank:5, suit:'D' }, { rank:5, suit:'C' }])
const solution = ref(null)
const feedback = ref('')
const usedByCard = ref([0,0,0,0])
const tokens = ref([])
const ops = ['+','-','�?,'�?,'(',')']
const faceUseHigh = ref(false)
// 閺堫剚澧滈弰顖氭儊瀹歌尪顔囬崚鍡礄閸忓牆鍩岄崗鍫濈繁�?const handRecorded = ref(false)
// 鐞涖劏鎻蹇撳隘閸╃喖鐝惔锔肩礄閻劋绨懛顏堚偓鍌氱安鐢啫鐪敍?const exprZoneHeight = ref(200)

// 瑜版挸澧犻悽銊﹀�?const currentUser = ref(null)

// 娑撯偓閸擃垳澧濇稉杞扮鐏炩偓閿涙氨澧濋崼鍡曠瑢缂佺喕顓?const deck = ref([]) // 閸撯晙缍戦悧灞界�?const handsPlayed = ref(0)
const successCount = ref(0)
const failCount = ref(0)
const sessionOver = ref(false)
const remainingCards = computed(() => (deck.value || []).length)
const winRate = computed(() => {
  const t = successCount.value + failCount.value
  return t ? Math.round(100 * successCount.value / t) : 0
})

const drag = ref({ active: false, token: null, x: 0, y: 0, startX: 0, startY: 0, moved: false })
const exprBox = ref({ left: 0, top: 0, right: 0, bottom: 0 })
const tokRects = ref([])
const dragInsertIndex = ref(-1)
const lastInsertedIndex = ref(-1)
const { proxy } = getCurrentInstance()

// 閸氼垰濮╅崝銊ф暰
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
  if (!deck.value || deck.value.length < 4) { sessionOver.value = true; feedback.value = '閻楀苯鍑￠悽銊ョ暚閿涘本婀扮仦鈧紒鎾存将'; onSessionOver(); return }
  // 鐏忔繆鐦禒搴″⒖娴ｆ瑧澧濋崼鍡曡厬閹惰棄褰囬崣顖澬掗�?�?  const maxTry = Math.min(200, 1 + (deck.value.length * deck.value.length))
  let pickIdx = null
  for (let t=0; t<maxTry; t++) {
    // 闂呭繑婧€閹?娑擃亙绗夐崥宀€鍌ㄥ?    const idxs = new Set()
    while (idxs.size < 4) idxs.add(Math.floor(Math.random() * deck.value.length))
    const ids = Array.from(idxs)
    const cs = ids.map(i => deck.value[i])
    const mapped = cs.map(c => evalRank(c.rank))
    const sol = solve24(mapped)
    if (sol) { pickIdx = { ids, sol }; break }
  }
  if (!pickIdx) {
    sessionOver.value = true
    feedback.value = '閸撯晙缍戦幍鎴濆帬閺冪姾袙閿涘本婀扮仦鈧紒鎾存将'
    onSessionOver()
    return
  }
  // 閸欐牕鍤獮鏈电矤閻楀苯鐖㈢粔濠氭�?  const ids = pickIdx.ids.sort((a,b)=>b-a) // 娴犲骸銇囬崚鏉跨毈閸掔娀娅庨柆鍨帳闁插秵甯撻梻顕€�?  const cs = []
  for (const i of ids) { cs.unshift(deck.value[i]); deck.value.splice(i,1) }
  cards.value = cs
  solution.value = pickIdx.sol
  tokens.value = []
  usedByCard.value = [0,0,0,0]
  handRecorded.value = false
  feedback.value = '鐠囬鏁ら崶娑樼炊閻?+ - �?�?( ) 缁犳鍤?24'
  nextTick(() => recomputeExprHeight())
}

onMounted(() => {
  ensureInit()
  currentUser.value = getCurrentUser() || null
  initDeck()
  nextHand()
  // 閸氼垰濮╅崝銊ф暰鐟欙箑褰?  setTimeout(() => { booted.value = true }, 0)
  // 閸掓繂顫愮拋锛勭暬鐞涖劏鎻蹇涚彯�?  nextTick(() => { updateVHVar(); recomputeExprHeight() })
})

function clearAll() { tokens.value = []; usedByCard.value = [0,0,0,0] }

function check() {
  const usedCount = usedByCard.value.reduce((a,b)=>a+(b?1:0),0)
  if (usedCount !== 4) { feedback.value = '鐞涖劏鎻蹇旀弓濮濓絿鈥樻担璺ㄦ暏閸ユ稑绱堕悧宀嬬礄濮ｅ繐绱堕崥鍕濞嗏槄�?; return }
  const s = expr.value
  const v = evaluateExprToFraction(s)
  const ok = (v && v.equalsInt && v.equalsInt(24))
  feedback.value = ok ? '濮濓絿鈥橀敍浣逛純閸犳粈缍樼粻妤€�?24' : '缂佹挻鐏夋稉宥嗘Ц 24閿涘矁顕崘宥堢槸鐠囨洩�?
  // 鐠佹澘缍嶆稉鈧▎鈥愁嚠鐏炩偓閿涘本娲块弬鐗堟付鏉╂垶鐖堕悳鈺傛闂?  try { pushRound(!!ok) } catch (_) {}
  // 娴犲懎婀＃鏍偧閹存劕濮涢弮鎯邦唶閸掑棴绱辨径杈Е閹绘劒姘︽稉宥堫吀�?  if (ok && !handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    successCount.value += 1
    try { pushRound(true) } catch (_) {}
  }
}

function showSolution() {
  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try { pushRound(false) } catch (_) {}
  }
  feedback.value = solution.value ? ('答案�? + solution.value) : '暂无提示'
}

function toggleFaceMode() {
  faceUseHigh.value = !faceUseHigh.value
}
// 换题按钮：若本手未记分，按失败记一次，然后发下一�?function skipHand() {
  if (!handRecorded.value) {
    handRecorded.value = true
    handsPlayed.value += 1
    failCount.value += 1
    try { pushRound(false) } catch (_) {}
  }
  nextHand()
}

// 妞ょ敻娼扮€佃壈�?function goLogin(){ try { uni.reLaunch({ url:'/pages/login/index' }) } catch(e1){ try { uni.navigateTo({ url:'/pages/login/index' }) } catch(_){} } }
function goStats(){ try { uni.navigateTo({ url:'/pages/stats/index' }) } catch(_){} }
function goGame(){ try { uni.reLaunch({ url:'/pages/index/index' }) } catch(_){} }
function goUser(){ try { uni.navigateTo({ url:'/pages/user/index' }) } catch(_){} }

// 閹锋牗瀚块惄绋垮彠
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
  // 鐎圭偞妞傞柌宥嗗�?閸楃姳缍?
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
  // 婢跺嫮鎮婇崣灞藉毊閿涙艾鈧瑩鈧灏崣灞藉毊鏉╄棄濮為敍宀冦€冩潏鎯х础閸愬懎寮婚崙鑽ば╅梽?
  if (token && !drag.value.moved) {
    const now = Date.now()
    const key = tapKeyFor(token)
    if (now - (lastTap.value.time || 0) < 300 && lastTap.value.key === key) {
      // 閸欏苯鍤悽鐔告櫏
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
      // 閸楁洖鍤稉宥呬粵閹垮秳缍旈敍宀€娲块幒銉︽暪鐏?
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
    if (ci == null) { feedback.value = '鐠囥儱宕遍悧鍥︿繆閹垳宸辨�?; return }
    if ((usedByCard.value[ci] || 0) >= 1) { feedback.value = '鐠囥儱宕遍悧鍥у嚒閻劏绻?; return }
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

// �?JS 閺傜懓绱＄拋鍓х枂 --vh閿涘苯鍚嬬€归€涚瑝閺€顖涘�?dvh �?Android/iOS WebView
function updateVHVar() {
  try {
    const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
    const h = sys.windowHeight || (typeof window !== 'undefined' ? window.innerHeight : 0) || 0
    if (h) document.documentElement && document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px')
  } catch (e) { /* noop */ }
}

// 鐠侊紕鐣荤悰銊ㄦ彧瀵繐灏崺鐔峰讲閻劑鐝惔锔肩礉绾喕绻氶弫鎾€夋稉鈧仦蹇旀▔缁�?
function recomputeExprHeight() {
  const sys = (uni.getSystemInfoSync && uni.getSystemInfoSync()) || {}
  const winH = sys.windowHeight || sys.screenHeight || 0
  // 閺嶈宓佺仦蹇撶妤傛ê瀹抽懛顏堚偓鍌氱安鏉╂劗鐣荤粭锕€鏄傜€甸潻绱欓梼鍫濃偓鐓庡讲鐠嬪喛�?
  if (winH && winH < 640) opsDensity.value = 'tight'
  else if (winH && winH < 740) opsDensity.value = 'compact'
  else opsDensity.value = 'normal'
  // 缁涘绶熺€靛棗瀹崇猾璇茬安閻劌鎮楅崘宥嗙ゴ闁?
  nextTick(() => {
    const q = uni.createSelectorQuery().in(proxy)
    q.select('#exprZone').boundingClientRect()
     .select('#bottomBar').boundingClientRect()
     .exec(res => {
       const [exprRect, bottomRect] = res || []
       if (!exprRect) return
       const bottomTop = bottomRect && bottomRect.top ? bottomRect.top : winH
       let avail = bottomTop - exprRect.top - 16 // 閻ｆ瑥鍤惔鏇㈠劥缁屾椽�?
       if (!isFinite(avail) || avail <= 0) avail = 120
       // 闂勬劕鍩楁稉瀣閿涘矂浼╅崗宥堢箖�?
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
// 閸樼喖娈㈤張铏规晸閹存劙鈧槒绶鑼额潶閻楀苯鐖㈤張鍝勫煑閺囨寧�?
// 本副牌结束：弹窗询问是否开始下一局
function onSessionOver() {
  try {
    uni.showModal({
      title: "本局结束",
      content: `次数�?{handsPlayed.value}\n成功�?{successCount.value}\n胜率�?{winRate.value}%\n是否开始下一局？`,
      confirmText: "下一局",
      cancelText: "统计�?,
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
          try { uni.navigateTo({ url: "/pages/stats/index" }) } catch (_) {}
        }
      }
    })
  } catch (_) { /* noop */ }
}</script>

<style scoped>
.page { min-height: calc(var(--vh, 1vh) * 90); background: linear-gradient(180deg, #f7f9ff 0%, #a7ceff 100%); display:flex; flex-direction: column; }
.page { opacity: 0; }
.page.booted { animation: page-fade-in .28s ease-out forwards; }
.topbar { position: sticky; top: 0; z-index: 10; padding: 18rpx 0; background: rgba(255,255,255,0.88); backdrop-filter: blur(6rpx); border-bottom: 2rpx solid #e5e7eb; }
.topbar-title { font-size: 36rpx; font-weight: 700; color:#1f2937; text-align:center; width:100%; display:block; }

/* 閸楋紕澧濋崠鍝勭�?*/
.card-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18rpx; }
.card { background:#fff; border-radius:28rpx; overflow:hidden; box-shadow:0 12rpx 28rpx rgba(15,23,42,.08); }
.card.used { filter: grayscale(1) saturate(.2); opacity:.5; }
.card-img { width:100%; height:auto; display:block; }

/* 鏉╂劗鐣荤粭锔跨瑢閹貉冨煑閸?*/
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

/* 闁氨鏁ら幐澶愭�?*/
.btn { border:none; border-radius:20rpx; padding:28rpx 0; font-size:34rpx; line-height:1; box-shadow:0 10rpx 24rpx rgba(15,23,42,.06); width:100%; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
.btn-operator { background:#fff; color:#2563eb; border:2rpx solid #e5e7eb; }
.btn-primary { background:#145751; color:#fff; }
.btn-secondary { 
  color:#0f172a; 
  background: linear-gradient(to bottom, #f8fafc, #0961d3);
  box-shadow: 
  0 10px 12px rgba(0, 0, 0, 0.1),   /* 婢舵牠妲捐ぐ鎲嬬窗閹稿鎸抽幃顒佽癁�?*/
  inset 0 1px 2px rgba(255, 255, 255, 0.6); /* 閸愬懘妲捐ぐ鎲嬬窗妤傛ê鍘?*/
  border-radius: 0.5rem;  
  transition: all 0.2s ease-in-out;
}
.full { width:100%; }

/* 鏉╂劗鐣荤粭锕佸殰闁倸绨茬€靛棗瀹抽敍鍫熺壌閹诡喖鐫嗛獮鏇㈢彯鎼达箑鍨忛幑顫礆 */
.ops-compact .btn-operator, .ops-compact .mode-btn { padding:22rpx 0; font-size:30rpx; }
.ops-compact.ops-row-1, .ops-compact.ops-row-2, .ops-compact .ops-left { gap:14rpx; }
.ops-tight .btn-operator, .ops-tight .mode-btn { padding:18rpx 0; font-size:26rpx; }
.ops-tight.ops-row-1, .ops-tight.ops-row-2, .ops-tight .ops-left { gap:10rpx; }

/* 鐞涖劏鎻蹇撳隘閸?*/
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
