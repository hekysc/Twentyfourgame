// 通用计算工具函数，保持纯函数特性，便于在页面外复用与单测。

/**
 * 将扑克牌点数映射为计算用的数值。
 * @param {number} rank 扑克牌原始点数（1-13）。
 * @param {boolean} faceUseHigh 是否使用面牌高位映射（J/Q/K=11/12/13）。
 * @returns {number}
 */
export function mapCardRank(rank, faceUseHigh) {
  if (rank === 1) return 1
  if (rank === 11 || rank === 12 || rank === 13) return faceUseHigh ? rank : 1
  return rank
}

/**
 * 获取用于显示的面牌标签。
 * @param {number} rank
 * @returns {string}
 */
export function labelForRank(rank) {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

/**
 * 根据牌面返回图片路径。
 * @param {{rank: number, suit: 'S'|'H'|'D'|'C'}} card
 * @returns {string}
 */
export function cardImagePath(card) {
  const suitMap = { S: 'Spade', H: 'Heart', D: 'Diamond', C: 'Club' }
  const faceMap = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
  const suitName = suitMap[card.suit] || 'Spade'
  const rankName = faceMap[card.rank] || String(card.rank)
  return `/static/cards/${suitName}${rankName}.png`
}

/**
 * 将分数值格式化为字符串。
 * @param {{n:number,d:number}|Fraction|null} frac
 * @returns {string}
 */
export function formatFractionValue(frac) {
  if (!frac) return ''
  const n = typeof frac.n === 'number' ? frac.n : 0
  const d = typeof frac.d === 'number' ? frac.d : 1
  return d === 1 ? String(n) : `${n}/${d}`
}

/**
 * 去除表达式外围冗余括号。
 * @param {string} str
 * @returns {string}
 */
export function stripOuterParens(str) {
  if (!str) return ''
  let text = str.trim()
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0
    let balanced = true
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth < 0) { balanced = false; break }
        if (depth === 0 && i < text.length - 1) { balanced = false; break }
      }
    }
    if (!balanced || depth !== 0) break
    text = text.slice(1, -1).trim()
  }
  return text
}

/**
 * 将表达式和分数结果拼接成展示文案。
 * @param {string} expr
 * @param {{n:number,d:number}|Fraction|null} value
 * @returns {string}
 */
export function formatExpressionWithValue(expr, value) {
  const trimmed = stripOuterParens(expr || '')
  if (!trimmed) return ''
  const valText = value ? formatFractionValue(value) : ''
  return valText ? `${trimmed}=${valText}` : trimmed
}

/**
 * 统计表达式中运算符、长度和最大括号深度。
 * @param {string} expression
 * @returns {{ops:string[], exprLen:number, maxDepth:number}}
 */
export function statsFromExpressionString(expression) {
  if (!expression) return { ops: [], exprLen: 0, maxDepth: 0 }
  const ops = []
  let exprLen = 0
  let depth = 0
  let maxDepth = 0
  const tokens = expression.match(/10|11|12|13|[1-9]|[()+\-×÷]/g) || []
  for (const tok of tokens) {
    exprLen += 1
    if (tok === '(') {
      depth += 1
      if (depth > maxDepth) maxDepth = depth
    } else if (tok === ')') {
      depth = Math.max(0, depth - 1)
    } else if ('+-×÷'.includes(tok)) {
      ops.push(tok)
    }
  }
  return { ops, exprLen, maxDepth }
}

/**
 * 根据 token 列表生成用于求值的表达式字符串。
 * @param {Array} tokens
 * @param {boolean} faceUseHigh
 * @returns {string}
 */
export function tokensToExpression(tokens, faceUseHigh) {
  return (tokens || []).map(t => {
    if (t.type === 'num') {
      const rank = typeof t.rank === 'number' ? t.rank : Number(t.value)
      return String(mapCardRank(rank, faceUseHigh))
    }
    return t.value || ''
  }).join('')
}

/**
 * 统计表达式 token 的结构信息。
 * @param {Array} tokens
 * @returns {{exprLen:number,maxDepth:number,ops:string[]}}
 */
export function computeExprStats(tokens) {
  const arr = tokens || []
  const ops = []
  let depth = 0
  let maxDepth = 0
  for (const t of arr) {
    if (t.type === 'op') {
      if (t.value === '(') {
        depth += 1
        if (depth > maxDepth) maxDepth = depth
        continue
      }
      if (t.value === ')') {
        depth = Math.max(0, depth - 1)
        continue
      }
      if (t.value === '+' || t.value === '-' || t.value === '×' || t.value === '÷') ops.push(t.value)
    }
  }
  return { exprLen: arr.length, maxDepth, ops }
}

/**
 * 判断表达式 token 是否组成合法表达式。
 * @param {Array} tokens
 * @returns {boolean}
 */
export function isExpressionComplete(tokens) {
  const arr = tokens || []
  if (!arr.length) return false
  let bal = 0
  let prev = null
  const isBin = v => (v === '+' || v === '-' || v === '×' || v === '÷')
  for (const t of arr) {
    if (t.type === 'op' && t.value === '(') bal += 1
    else if (t.type === 'op' && t.value === ')') {
      bal -= 1
      if (bal < 0) return false
    }
    if (!prev) {
      if (t.type === 'op' && (t.value === ')' || isBin(t.value))) return false
    } else {
      const pa = prev.type === 'op' ? prev.value : 'num'
      const pb = t.type === 'op' ? t.value : 'num'
      if (isBin(pa) && isBin(pb)) return false
      if (prev.type === 'num' && t.type === 'op' && t.value === '(') return false
      if (prev.type === 'op' && prev.value === ')' && t.type === 'num') return false
      if (prev.type === 'num' && t.type === 'num') return false
    }
    prev = t
  }
  const last = arr[arr.length - 1]
  if (last && last.type === 'op' && (last.value === '(' || isBin(last.value))) return false
  return bal === 0
}

/**
 * 以毫秒为单位格式化时间。
 * @param {number} ms
 * @returns {string}
 */
export function formatMs(ms) {
  if (!Number.isFinite(ms)) return '-'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return `${m}m${r}s`
}

/**
 * 以毫秒为单位格式化短时长，120 秒内带小数。
 * @param {number} ms
 * @returns {string}
 */
export function formatMsShort(ms) {
  if (!Number.isFinite(ms)) return '-'
  const s = ms / 1000
  if (s < 120) return `${s.toFixed(1)}s`
  return formatMs(ms)
}

/**
 * 根据给定的 4 张牌尝试寻找可解组合。
 * @param {Array<{rank:number,suit:string}>} cards
 * @param {boolean} faceUseHigh
 * @returns {{mapped:number[], raw:number[]}}
 */
export function mapCardsForSolve(cards, faceUseHigh) {
  const mapped = []
  const raw = []
  for (const card of cards || []) {
    const rank = mapCardRank(card.rank, faceUseHigh)
    mapped.push(rank)
    raw.push(card.rank)
  }
  return { mapped, raw }
}

/**
 * 计算两个分数的四则运算。
 * @param {Fraction} a
 * @param {Fraction} b
 * @param {'+'|'-'|'×'|'÷'} op
 * @returns {Fraction}
 */
export function operateFractions(a, b, op) {
  if (!a || !b) return null
  if (op === '+') return a.plus(b)
  if (op === '-') return a.minus(b)
  if (op === '×') return a.times(b)
  if (op === '÷') {
    if (b.n === 0) throw new Error('divide-by-zero')
    return a.div(b)
  }
  return null
}

/**
 * 生成洗牌后的完整牌堆。
 * @returns {Array<{rank:number,suit:'S'|'H'|'D'|'C'}>}
 */
export function createShuffledDeck() {
  const suits = ['S', 'H', 'D', 'C']
  const arr = []
  for (const s of suits) {
    for (let r = 1; r <= 13; r++) {
      arr.push({ rank: r, suit: s })
    }
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 简易示例：
// const deck = createShuffledDeck();
// console.log(deck.length); // 52
// console.log(tokensToExpression([{ type: 'num', rank: 1 }, { type: 'op', value: '+' }, { type: 'num', rank: 3 }], false));
