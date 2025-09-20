import { Fraction } from '../utils/solver.js'
import {
  mapCardRank,
  labelForRank,
  formatFractionValue,
  formatExpressionWithValue,
  stripOuterParens,
  statsFromExpressionString,
  operateFractions,
} from '../utils/calc.js'

/**
 * 根据输入牌面生成 Basic 模式初始状态。
 * @param {Array<{rank:number,suit:string}>} cards
 * @param {boolean} faceUseHigh
 * @returns {{ slots: Array, expression: string, displayExpression: string }}
 */
export function createBasicState(cards, faceUseHigh) {
  const slots = []
  for (let i = 0; i < 4; i++) {
    const card = cards && cards[i]
    if (card) {
      const mapped = mapCardRank(card.rank, faceUseHigh)
      const value = new Fraction(mapped, 1)
      slots.push({
        id: i,
        alive: true,
        value,
        expr: String(mapped),
        displayExpr: displayLabelForBasic(card, faceUseHigh),
        label: formatFractionValue(value),
        card: { rank: card.rank, suit: card.suit },
        source: 'card',
      })
    } else {
      slots.push({
        id: i,
        alive: false,
        value: null,
        expr: '',
        displayExpr: '',
        label: '',
        card: null,
        source: 'card',
      })
    }
  }
  return {
    slots,
    expression: '',
    displayExpression: '',
  }
}

/**
 * 组合两个 slot，返回新状态及计算结果。
 * @param {Object} state
 * @param {Array} state.slots
 * @param {Array} state.history
 * @param {string} state.expression
 * @param {string} state.displayExpression
 * @param {number} firstIdx
 * @param {number} secondIdx
 * @param {'+'|'-'|'×'|'÷'} op
 * @returns {Object}
 */
export function combineBasicSlots(state, firstIdx, secondIdx, op) {
  const { slots, history = [], expression = '', displayExpression = '' } = state || {}
  if (firstIdx === secondIdx) {
    return { ok: false, err: 'SAME_INDEX' }
  }
  const first = slots && slots[firstIdx]
  const second = slots && slots[secondIdx]
  if (!first || !second || !first.alive || !second.alive) {
    return { ok: false, err: 'INACTIVE_SLOT' }
  }
  let result
  try {
    result = operateFractions(first.value, second.value, op)
  } catch (e) {
    if (e && e.message === 'divide-by-zero') {
      return { ok: false, err: 'DIVIDE_BY_ZERO' }
    }
    return { ok: false, err: 'INVALID_OPERATION' }
  }
  if (!result) return { ok: false, err: 'INVALID_OPERATION' }

  const snapshot = {
    slots: cloneSlotsForHistory(slots),
    expression,
    displayExpression,
  }

  const newExpr = `(${first.expr}${op}${second.expr})`
  const newDisplayExpr = `(${first.displayExpr}${op}${second.displayExpr})`

  const updatedSlots = slots.map((slot, idx) => {
    if (!slot) return null
    if (idx === firstIdx) {
      return { ...slot, alive: false }
    }
    if (idx === secondIdx) {
      return {
        id: slot.id,
        alive: true,
        value: result,
        expr: newExpr,
        displayExpr: newDisplayExpr,
        label: formatFractionValue(result),
        card: null,
        source: 'value',
      }
    }
    if (!slot.value) return { ...slot }
    return {
      id: slot.id,
      alive: slot.alive,
      value: slot.value ? new Fraction(slot.value.n, slot.value.d) : null,
      expr: slot.expr,
      displayExpr: slot.displayExpr,
      label: slot.label,
      card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
      source: slot.source,
    }
  })

  const alive = updatedSlots.filter(s => s && s.alive)
  const exprForRecord = stripOuterParens(newExpr)
  const stats = statsFromExpressionString(exprForRecord)

  return {
    ok: true,
    data: {
      slots: updatedSlots,
      history: [...history, snapshot],
      expression: newExpr,
      displayExpression: formatExpressionWithValue(newDisplayExpr, result),
      result,
      aliveCount: alive.length,
      exprForRecord,
      stats,
      isSolved: alive.length === 1 && result.equalsInt && result.equalsInt(24),
    },
  }
}

/**
 * 撤销 Basic 模式一步操作。
 * @param {Array} history
 * @returns {{ok:false,err:string}|{ok:true,data:{history:Array,slots:Array,expression:string,displayExpression:string}}}
 */
export function undoBasicHistory(history) {
  if (!history || !history.length) {
    return { ok: false, err: 'EMPTY_HISTORY' }
  }
  const nextHistory = history.slice(0, history.length - 1)
  const snapshot = history[history.length - 1]
  return {
    ok: true,
    data: {
      history: nextHistory,
      slots: restoreSlotsFromHistory(snapshot.slots || []),
      expression: snapshot.expression || '',
      displayExpression: snapshot.displayExpression || '',
    },
  }
}

function cloneSlotsForHistory(slots) {
  return (slots || []).map(slot => {
    if (!slot) return null
    return {
      id: slot.id,
      alive: slot.alive,
      value: slot.value ? { n: slot.value.n, d: slot.value.d } : null,
      expr: slot.expr,
      displayExpression: slot.displayExpression || slot.displayExpr,
      displayExpr: slot.displayExpr,
      label: slot.label,
      card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
      source: slot.source,
    }
  })
}

function restoreSlotsFromHistory(slots) {
  return (slots || []).map(slot => {
    if (!slot) return null
    return {
      id: slot.id,
      alive: slot.alive,
      value: slot.value ? new Fraction(slot.value.n, slot.value.d) : null,
      expr: slot.expr,
      displayExpr: slot.displayExpr || slot.displayExpression || '',
      label: slot.label,
      card: slot.card ? { rank: slot.card.rank, suit: slot.card.suit } : null,
      source: slot.source,
    }
  })
}

function displayLabelForBasic(card, faceUseHigh) {
  if (!card) return ''
  const mapped = mapCardRank(card.rank, faceUseHigh)
  if ((card.rank === 11 || card.rank === 12 || card.rank === 13) && !faceUseHigh) {
    return String(mapped)
  }
  return labelForRank(card.rank)
}

// 调试示例：
// const state = createBasicState([{ rank: 1, suit: 'S' }, { rank: 1, suit: 'H' }, { rank: 1, suit: 'D' }, { rank: 1, suit: 'C' }], false)
// const res = combineBasicSlots({ ...state, slots: state.slots, history: [] }, 0, 1, '+')
// console.log(res.ok, res.data.expression)
