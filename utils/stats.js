// 统计与派生数据计算（纯函数，不依赖 Vue 响应式）

// 表达式求值（仅用于近似判断 24 的“接近程度”场景）
export function evalExprToNumber(expr) {
  if (!expr || typeof expr !== 'string') return null
  const cleaned = expr
    .replace(/[×脳]/g, '*')
    .replace(/[÷梅]/g, '/')
    .replace(/\s+/g, '')
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null
  try {
    // eslint-disable-next-line no-new-func
    const val = Function('"use strict";return(' + cleaned + ')')()
    return (typeof val === 'number' && Number.isFinite(val)) ? val : null
  } catch (_) { return null }
}

// 概览-趋势柱（按天聚合，最多 30 天）
export function computeTrendBars(rounds) {
  const byDay = new Map()
  for (const r of (rounds || [])) {
    const key = new Date(r.ts || 0).toISOString().slice(0, 10)
    const cur = byDay.get(key) || { total: 0, success: 0 }
    cur.total += 1; if (r.success) cur.success += 1
    byDay.set(key, cur)
  }
  let days = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  days = days.slice(-30)
  const maxTotal = Math.max(1, ...days.map(([, v]) => v.total))
  return days.map(([k, v]) => {
    const h = Math.max(4, Math.round(120 * (v.total / maxTotal)))
    const rate = v.total ? (v.success / v.total) : 0
    const color = v.total ? '#16a34a' : '#e5e7eb'
    return { label: k, height: Math.max(6, Math.round(h * rate)), color }
  })
}

const RANK_TIERS = [
  { key: 'mythic', label: '神话', icon: '🐉', color: '#f97316', minWinRate: 85, minStreak: 10 },
  { key: 'grandmaster', label: '宗师', icon: '🏆', color: '#facc15', minWinRate: 75, minStreak: 7 },
  { key: 'diamond', label: '钻石', icon: '💎', color: '#38bdf8', minWinRate: 65, minStreak: 5 },
  { key: 'gold', label: '黄金', icon: '🥇', color: '#fbbf24', minWinRate: 55, minStreak: 3 },
  { key: 'silver', label: '白银', icon: '🥈', color: '#cbd5f5', minWinRate: 40, minStreak: 2 },
  { key: 'bronze', label: '青铜', icon: '🥉', color: '#f59e0b', minWinRate: 0, minStreak: 0 },
]

function clamp01(v) { return Math.max(0, Math.min(1, v)) }

export function resolveRankTier(winRate = 0, longestWinStreak = 0) {
  const tiers = RANK_TIERS.slice()
  let matched = tiers[tiers.length - 1]
  for (const tier of tiers) {
    if (winRate >= tier.minWinRate || longestWinStreak >= tier.minStreak) {
      matched = tier
      break
    }
  }
  const idx = tiers.findIndex(t => t.key === matched.key)
  const nextTier = idx > 0 ? tiers[idx - 1] : null
  const winRange = nextTier ? (nextTier.minWinRate - matched.minWinRate) : 0
  const streakRange = nextTier ? (nextTier.minStreak - matched.minStreak) : 0
  const winProgress = winRange > 0 ? (winRate - matched.minWinRate) / winRange : 1
  const streakProgress = streakRange > 0 ? (longestWinStreak - matched.minStreak) / streakRange : 1
  const progress = clamp01(Math.max(winProgress, streakProgress))
  return {
    ...matched,
    progress,
    progressPct: Math.round(progress * 100),
    nextTier,
  }
}

// 总览表-行聚合（受时间窗口影响）
export function computeOverviewRows(userRows, userExtMap, cutoffMs = 0) {
  const items = (userRows || []).map(u => {
    const rec = (userExtMap && userExtMap[u.id]) || { rounds: [], agg: {} }
    const rounds = (rec.rounds || []).filter(r => (!cutoffMs || (r.ts || 0) >= cutoffMs))
    const total = rounds.length
    const success = rounds.filter(r => r.success).length
    const fail = total - success
    const winRate = total ? Math.round(100 * success / total) : 0
    const times = rounds.filter(r => r.success && Number.isFinite(r.timeMs)).map(r => r.timeMs)
    const bestTimeMs = times.length ? Math.min(...times) : null
    const avgTimeMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
    const streaks = computeStreakStats(rounds)
    const currentWin = streaks.curWin || 0
    const maxWin = Math.max(streaks.maxWin || 0, u.longestStreak || 0)
    const tier = resolveRankTier(winRate, maxWin)
    const successPct = total ? Math.round((success / total) * 100) : 0
    const failPct = total ? Math.max(0, 100 - successPct) : 0
    return {
      id: u.id,
      name: u.name,
      total,
      success,
      fail,
      times: total,
      winRate,
      bestTimeMs,
      avgTimeMs,
      currentWin,
      maxWin,
      tier,
      successPct,
      failPct,
    }
  })
  items.sort((a, b) => (b.winRate - a.winRate) || (b.times - a.times) || (b.maxWin - a.maxWin))
  return items
}

// 分位数（输入需为已排序的数组）
export function percentile(sortedArray, p) {
  if (!sortedArray.length) return 0
  const idx = Math.min(sortedArray.length - 1, Math.max(0, Math.ceil((p / 100) * sortedArray.length) - 1))
  return +sortedArray[idx].toFixed(3)
}

// 近似 24 的“接近程度”表（Top 5）
export function computeNearMisses(rounds) {
  const rows = []
  for (const r of (rounds || [])) {
    if (r && !r.success && typeof r.expr === 'string') {
      const v = evalExprToNumber(r.expr)
      if (v == null) continue
      const diff = v - 24
      const abs = Math.abs(diff)
      rows.push({ ts: r.ts || 0, expr: r.expr, value: v, diff, abs })
    }
  }
  rows.sort((a, b) => a.abs - b.abs)
  return rows.slice(0, 5)
}

// “接近”摘要
export function summarizeNearMisses(rounds) {
  const diffs = [] // { abs, sign }
  for (const r of (rounds || [])) {
    if (r && !r.success && typeof r.expr === 'string') {
      const v = evalExprToNumber(r.expr)
      if (v == null) continue
      const d = v - 24
      diffs.push({ abs: Math.abs(d), sign: Math.sign(d) })
    }
  }
  const absArr = diffs.map(x => x.abs).sort((a, b) => a - b)
  const count = absArr.length
  if (!count) return { count: 0, median: '-', p90: '-', lt1: 0, lt01: 0, biasUp: 0, biasDown: 0 }
  const median = percentile(absArr, 50)
  const p90 = percentile(absArr, 90)
  const lt1 = Math.round(100 * (absArr.filter(x => x < 1).length / count))
  const lt01 = Math.round(100 * (absArr.filter(x => x < 0.1).length / count))
  const up = diffs.filter(x => x.sign > 0).length
  const down = diffs.filter(x => x.sign < 0).length
  const total = up + down
  const biasUp = total ? Math.round(100 * up / total) : 0
  const biasDown = total ? Math.round(100 * down / total) : 0
  return { count, median, p90, lt1, lt01, biasUp, biasDown }
}

// 运算符使用与熵
export function computeOpStats(rounds) {
  const ops = ['+', '-', '×', '÷']
  const aliases = { '脳': '×', '梅': '÷' }
  const first = Object.fromEntries(ops.map(o => [o, { total: 0, success: 0 }]))
  const allCounts = Object.fromEntries(ops.map(o => [o, 0]))
  for (const r of (rounds || [])) {
    const seq0 = Array.isArray(r?.ops) ? r.ops : []
    const seq = seq0.map(o => aliases[o] || o)
    if (seq.length) {
      const f = seq[0]
      if (first[f]) { first[f].total += 1; if (r.success) first[f].success += 1 }
    }
    for (const o of seq) { if (allCounts[o] != null) allCounts[o] += 1 }
  }
  const totalOps = Object.values(allCounts).reduce((a, b) => a + b, 0)
  let entropy = 0
  if (totalOps > 0) {
    for (const o of ops) {
      const p = allCounts[o] / totalOps
      if (p > 0) entropy += -p * Math.log2(p)
    }
  }
  const entropyMax = Math.log2(4)
  const entropyPct = entropyMax ? Math.round((entropy / entropyMax) * 100) : 0
  return { first, allCounts, totalOps, entropy, entropyPct }
}

// 运算序列（bigram/trigram、前两步）
export function computeSeqStats(rounds) {
  const big = new Map() // key -> { total, success }
  const tri = new Map()
  const firstTwo = new Map()
  const add = (map, key, success) => {
    if (!key) return
    const cur = map.get(key) || { total: 0, success: 0 }
    cur.total += 1; if (success) cur.success += 1
    map.set(key, cur)
  }
  for (const r of (rounds || [])) {
    const seq0 = Array.isArray(r?.ops) ? r.ops : []
    const seq = seq0.map(o => (o === '脳' ? '×' : o === '梅' ? '÷' : o))
    const ok = !!r?.success
    if (seq.length >= 2) add(firstTwo, `${seq[0]} → ${seq[1]}`, ok)
    for (let i = 0; i + 1 < seq.length; i++) add(big, `${seq[i]} ${seq[i + 1]}`, ok)
    for (let i = 0; i + 2 < seq.length; i++) add(tri, `${seq[i]} ${seq[i + 1]} ${seq[i + 2]}`, ok)
  }
  const toRows = (map) => Array.from(map.entries()).map(([key, v]) => ({ key, total: v.total, win: v.total ? Math.round(100 * v.success / v.total) : 0 }))
  const byTotal = (a, b) => (b.total - a.total) || (b.win - a.win)
  const topBigrams = toRows(big).sort(byTotal).slice(0, 6)
  const topTrigrams = toRows(tri).sort(byTotal).slice(0, 6)
  const firstTwoRows = toRows(firstTwo).sort(byTotal).slice(0, 6)
  return { topBigrams, topTrigrams, firstTwo: firstTwoRows }
}

// 连胜/连败
export function computeStreakStats(rounds) {
  const arr = (rounds || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))
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
}

// 技能（表格版）
export function computeSkillsRadar(rounds) {
  const list = rounds || []
  const total = list.length || 1
  const mk = (key, label, pred) => {
    let t = 0, ok = 0
    for (const r of list) {
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
    if (typeof r?.expr === 'string' && /[÷梅/]/.test(r.expr)) return true
    const v = typeof r?.expr === 'string' ? evalExprToNumber(r.expr) : null
    return (v != null && Math.abs(v - Math.round(v)) > 1e-9)
  }
  return [
    mk('plus', '＋ 加法', r => hasOp(r, '+')),
    mk('minus', '－ 减法', r => hasOp(r, '-')),
    mk('mul', '× 乘法', r => hasOp(r, '×') || hasOp(r, '脳')),
    mk('div', '÷ 除法', r => hasOp(r, '÷') || hasOp(r, '梅') || (typeof r?.expr === 'string' && r.expr.includes('/'))),
    mk('paren', '括号', hasParen),
    mk('frac', '分数/小数', hasFraction),
  ]
}

// 每日序列
export function computeDailySeries(rounds) {
  const byDay = new Map() // day -> { total, success, successTimes: [] }
  for (const r of (rounds || [])) {
    const key = new Date(r.ts || 0).toISOString().slice(0, 10)
    const cur = byDay.get(key) || { total: 0, success: 0, successTimes: [] }
    cur.total += 1; if (r.success) { cur.success += 1; if (Number.isFinite(r.timeMs)) cur.successTimes.push(r.timeMs) }
    byDay.set(key, cur)
  }
  return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

// 小火花序列（n 天）
export function computeSparkSeries(dailySeries, n) {
  const days = (dailySeries || []).slice(-n)
  return days.map(([, v]) => ({ rate: v.total ? (v.success / v.total) : 0 }))
}

// 牌面签名
export function handSignature(hand) {
  try {
    const cs = (hand && Array.isArray(hand.cards)) ? hand.cards : []
    const ranks = cs.map(c => +c.rank).filter(n => Number.isFinite(n)).sort((a, b) => a - b)
    return ranks.join(',')
  } catch (_) { return '' }
}

// 牌面热度（Top/Bottom）
export function computeFaceHeat(rounds, minTotal = 2) {
  const map = new Map()
  for (const r of (rounds || [])) {
    const sig = handSignature(r?.hand)
    if (!sig) continue
    const cur = map.get(sig) || { total: 0, success: 0 }
    cur.total += 1; if (r.success) cur.success += 1
    map.set(sig, cur)
  }
  const rows = Array.from(map.entries()).map(([sig, v]) => {
    const win = v.total ? Math.round(100 * v.success / v.total) : 0
    return { sig, total: v.total, success: v.success, win }
  }).filter(r => r.total >= minTotal)
  const top = rows.slice().sort((a, b) => (b.win - a.win) || (b.total - a.total)).slice(0, 5)
  const bottom = rows.slice().sort((a, b) => (a.win - b.win) || (b.total - a.total)).slice(0, 5)
  return { top, bottom, minTotal }
}

// 牌面签名 Top5（出现频次优先）
export function computeFaceSignStats(rounds) {
  const map = new Map() // sig -> { total, success }
  for (const r of (rounds || [])) {
    const sig = handSignature(r?.hand)
    if (!sig) continue
    const cur = map.get(sig) || { total: 0, success: 0 }
    cur.total += 1; if (r.success) cur.success += 1
    map.set(sig, cur)
  }
  const rows = Array.from(map.entries()).map(([sig, v]) => {
    const win = v.total ? Math.round(100 * v.success / v.total) : 0
    return { sig, total: v.total, success: v.success, win }
  })
  rows.sort((a, b) => (b.total - a.total) || (b.win - a.win))
  return rows.slice(0, 5)
}

// 用时分桶
export function computeSpeedBuckets(rounds) {
  const defs = [
    { label: '<5s', min: 0, max: 5000, minInclusive: true, maxInclusive: false },
    { label: '5-10s', min: 5000, max: 10000, minInclusive: true, maxInclusive: false },
    { label: '10-20s', min: 10000, max: 20000, minInclusive: true, maxInclusive: false },
    { label: '20-30s', min: 20000, max: 30000, minInclusive: true, maxInclusive: false },
    { label: '30-40s', min: 30000, max: 40000, minInclusive: true, maxInclusive: false },
    { label: '40-50s', min: 40000, max: 50000, minInclusive: true, maxInclusive: false },
    { label: '50-60s', min: 50000, max: 60000, minInclusive: true, maxInclusive: false },
    { label: '60-90s', min: 60000, max: 90000, minInclusive: true, maxInclusive: false },
    { label: '90-120s', min: 90000, max: 120000, minInclusive: true, maxInclusive: true },
    { label: '>120s', min: 120000, max: Infinity, minInclusive: false, maxInclusive: false },
  ]

  const rows = defs.map(def => ({ label: def.label, total: 0, success: 0, fail: 0, totalTimeMs: 0 }))

  const withinBucket = (value, def) => {
    if (!Number.isFinite(value)) return false
    const minOk = def.minInclusive === false ? (value > def.min) : (value >= def.min)
    const maxOk = def.maxInclusive ? (value <= def.max) : (value < def.max)
    return minOk && maxOk
  }

  for (const r of (rounds || [])) {
    if (!Number.isFinite(r?.timeMs)) continue
    const t = Math.max(0, Math.floor(r.timeMs))
    const idx = defs.findIndex(def => withinBucket(t, def))
    if (idx < 0) continue
    const row = rows[idx]
    row.total += 1
    if (r.success) row.success += 1
    else row.fail += 1
    row.totalTimeMs += t
  }

  return rows.map(row => ({
    label: row.label,
    total: row.total,
    success: row.success,
    fail: row.fail,
    avgTimeMs: row.total ? Math.round(row.totalTimeMs / row.total) : null,
  }))
}

// 徽章（基础规则，与原逻辑一致）
export function computeBadges(rounds, opStats, nearSummary, skillsRadar) {
  const out = []
  const list = rounds || []
  const total = list.length
  const success = list.filter(r => r.success).length
  const winRate = total ? (100 * success / total) : 0
  if (opStats?.entropyPct >= 75) out.push('多样策略家')
  else if (opStats?.entropyPct <= 35) out.push('单核偏好')
  const opsTotal = Math.max(1, opStats?.totalOps || 0)
  if (((opStats?.allCounts?.['×'] || 0) / opsTotal) >= 0.4) out.push('乘法偏爱')
  if ((nearSummary?.count > 0) && (nearSummary?.lt1 >= 50)) out.push('几近完美')
  const frac = (skillsRadar || []).find(x => x.key === 'frac')
  if (frac && frac.usePct > 0 && (winRate - frac.winPct) >= 20) out.push('分数易失手')
  const succWithRetries = list.filter(r => r.success && Number.isFinite(r.retries) && r.retries > 0).length
  const succTotal = list.filter(r => r.success).length || 1
  if (succWithRetries / succTotal >= 0.5 && succTotal >= 4) out.push('逆转高手')
  const succTimes = list.filter(r => r.success && Number.isFinite(r.timeMs)).map(r => r.timeMs)
  const best = succTimes.length ? Math.min(...succTimes) : Infinity
  if (best <= 1500) out.push('闪电解题')
  const withRetries = list.filter(r => Number.isFinite(r.retries))
  const avgRetriesAll = (withRetries.reduce((a, b) => a + b.retries, 0) / Math.max(1, withRetries.length)) || 0
  if (avgRetriesAll >= 1 && winRate >= 50) out.push('稳扎稳打')
  return out
}

