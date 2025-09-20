import { mapCardRank, createShuffledDeck } from '../utils/calc.js'
import { solve24 as defaultSolve24 } from '../utils/solver.js'

/**
 * 从给定牌堆中抽取一手可解的 4 张牌。
 * @param {Array<{rank:number,suit:string}>} deck
 * @param {boolean} faceUseHigh
 * @param {(nums:number[]) => string|null} solve24Fn
 * @returns {{ok:true,data:{cards:Array,deck:Array,solution:string}}|{ok:false,err:string}}
 */
export function drawSolvableHand(deck, faceUseHigh, solve24Fn = defaultSolve24) {
  const list = Array.isArray(deck) ? deck.slice() : []
  if (list.length < 4) {
    return { ok: false, err: 'DECK_INSUFFICIENT' }
  }
  const maxTry = Math.min(200, 1 + list.length * list.length)
  for (let t = 0; t < maxTry; t++) {
    const idxs = new Set()
    while (idxs.size < 4) idxs.add(Math.floor(Math.random() * list.length))
    const ids = Array.from(idxs)
    const cards = ids.map(i => list[i])
    const mapped = cards.map(c => mapCardRank(c.rank, faceUseHigh))
    const sol = solve24Fn(mapped)
    if (sol) {
      const remaining = list.slice()
      ids.sort((a, b) => b - a)
      const hand = []
      for (const i of ids) {
        hand.unshift(remaining[i])
        remaining.splice(i, 1)
      }
      return { ok: true, data: { cards: hand, deck: remaining, solution: sol } }
    }
  }
  return { ok: false, err: 'NO_SOLVABLE' }
}

/**
 * 创建一副新的洗好牌的牌堆。
 * @returns {Array<{rank:number,suit:string}>}
 */
export function newDeck() {
  return createShuffledDeck()
}

// 示例：
// const deck = newDeck()
// const res = drawSolvableHand(deck, false)
// console.log(res.ok ? res.data.cards.length : res.err)
