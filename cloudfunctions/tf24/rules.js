const { evaluateExprToFraction, solve24 } = require('./solver')
const DAY = 86400000
function weekKey(ts) {
  const d = new Date(ts + 8 * 3600000)
  const weekday = (d.getUTCDay() + 6) % 7
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
      weekday * DAY,
  )
    .toISOString()
    .slice(0, 10)
}
function validExpression(expr, cards, high) {
  if (
    typeof expr !== 'string' ||
    expr.length > 160 ||
    !/^[\d\s()+\-×÷]+$/.test(expr)
  )
    return false
  const nums = (expr.match(/\d+/g) || []).map(Number).sort((a, b) => a - b)
  const need = cards
    .map((c) => (c.rank > 10 && !high ? 1 : c.rank))
    .sort((a, b) => a - b)
  if (nums.length !== 4 || nums.some((n, i) => n !== need[i])) return false
  // Enforce operand/operator grammar; the historical evaluator alone accepts malformed adjacency.
  const tokens = expr.replace(/\s/g, '').match(/\d+|[()+\-×÷]/g) || []
  let operand = true,
    depth = 0
  for (const t of tokens) {
    if (operand) {
      if (t === '(') depth++
      else if (/^\d+$/.test(t)) operand = false
      else return false
    } else {
      if (t === ')') {
        if (--depth < 0) return false
      } else if ('+-×÷'.includes(t)) operand = true
      else return false
    }
  }
  if (operand || depth) return false
  try {
    const v = evaluateExprToFraction(expr)
    return !!v?.equalsInt(24)
  } catch (_) {
    return false
  }
}
function freshDeck() {
  return ['S', 'H', 'D', 'C'].flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })),
  )
}
function draw(deck, high) {
  let list =
    Array.isArray(deck) && deck.length >= 4 ? deck.slice() : freshDeck()
  for (let n = 0; n < 400; n++) {
    if (n === 200) list = freshDeck()
    const ids = new Set()
    while (ids.size < 4) ids.add(Math.floor(Math.random() * list.length))
    const cards = [...ids].map((i) => list[i])
    const solution = solve24(
      cards.map((c) => (c.rank > 10 && !high ? 1 : c.rank)),
    )
    if (solution)
      return { cards, deck: list.filter((_, i) => !ids.has(i)), solution }
  }
  throw new Error('暂时无法发牌，请重试')
}
function drawPack() {
  let deck = freshDeck()
  const questions = []
  for (let i = 0; i < 13 && deck.length >= 4; i++) {
    const ids = new Set()
    let hand = null
    for (let attempt = 0; attempt < 400 && !hand; attempt++) {
      ids.clear()
      while (ids.size < 4) ids.add(Math.floor(Math.random() * deck.length))
      const cards = [...ids].map((index) => deck[index])
      const low = cards.map((card) => (card.rank > 10 ? 1 : card.rank))
      const high = cards.map((card) => card.rank)
      const solutionLow = solve24(low)
      const solutionHigh = solve24(high)
      if (solutionLow && solutionHigh) {
        hand = {
          cards,
          deck: deck.filter((_, index) => !ids.has(index)),
        }
      }
    }
    // Discard any unsolvable remainder rather than crossing into a new deck.
    if (!hand) break
    deck = hand.deck
    questions.push({ cards: hand.cards, remaining: deck.length })
  }
  if (questions.length) questions[questions.length - 1].remaining = 0
  return questions
}
function emptyAggregate(uid, period) {
  return {
    uid,
    period,
    total: 0,
    success: 0,
    fail: 0,
    bestTimeMs: null,
    lastPlayedAt: 0,
  }
}
function updateAggregate(a, round) {
  const r = {
    ...a,
    total: a.total + 1,
    success: a.success + (round.success ? 1 : 0),
    fail: a.fail + (round.success ? 0 : 1),
    lastPlayedAt: round.ts,
  }
  if (round.success)
    r.bestTimeMs = Math.min(a.bestTimeMs ?? Infinity, round.timeMs)
  return r
}
function compare(a, b, metric) {
  return metric === 'rate'
    ? b.success * a.total - a.success * b.total
    : a.bestTimeMs - b.bestTimeMs
}
function ranked(rows, metric, period, now) {
  return rows
    .filter(
      (r) =>
        (period !== 'all' || now - r.lastPlayedAt < 7 * DAY) &&
        (metric === 'rate' ? r.total >= 13 : r.bestTimeMs !== null),
    )
    .sort((a, b) => compare(a, b, metric) || a.uid.localeCompare(b.uid))
    .map((r, i, arr) => ({
      ...r,
      rank: i === 0 || compare(arr[i - 1], r, metric) !== 0 ? i + 1 : 0,
    }))
    .reduce((out, r) => {
      if (!r.rank) r.rank = out[out.length - 1].rank
      out.push(r)
      return out
    }, [])
}
function updateBook(book, cards, success, now) {
  const nums = cards.map((c) => c.rank).sort((a, b) => a - b),
    key = nums.join(',')
  const p = book.ledger[key] || {
    key,
    nums,
    attempts: 0,
    wrong: 0,
    correct: 0,
    streakCorrect: 0,
    createdTs: now,
  }
  const r = {
    ...p,
    attempts: p.attempts + 1,
    wrong: p.wrong + (success ? 0 : 1),
    correct: p.correct + (success ? 1 : 0),
    streakCorrect: success ? p.streakCorrect + 1 : 0,
    lastSeenTs: now,
    lastResult: success ? 'correct' : 'wrong',
  }
  book.ledger[key] = r
  if (!success || book.active[key]) book.active[key] = r
  if (r.streakCorrect >= 5) delete book.active[key]
  return book
}
module.exports = {
  DAY,
  weekKey,
  validExpression,
  draw,
  drawPack,
  emptyAggregate,
  updateAggregate,
  ranked,
  updateBook,
}
