const { test } = require('node:test'),
  assert = require('node:assert/strict')
const R = require('../cloudfunctions/tf24/rules')
const cards = [1, 2, 3, 4].map((rank) => ({ rank, suit: 'S' }))
test('server validates arithmetic, uses every card once, rejects fabricated expressions', () => {
  assert.equal(R.validExpression('(1+3)×(2+4)', cards, false), true)
  for (const expr of [
    '24',
    '1+2+3+4',
    '(1+3)×(2+2)',
    '1 2 3 4+++',
    '(1+3)×(2+4);process.exit()',
    '1÷0',
  ])
    assert.equal(R.validExpression(expr, cards, false), false)
  assert.equal(
    R.validExpression('(1+3)×(2+4)', [{ rank: 11 }, ...cards.slice(1)], false),
    true,
  )
  assert.equal(
    R.validExpression('(1+3)×(2+4)', [{ rank: 11 }, ...cards.slice(1)], true),
    false,
  )
})
test('Beijing weekly rollover occurs precisely Monday midnight', () => {
  assert.equal(R.weekKey(Date.parse('2026-09-27T15:59:59.999Z')), '2026-09-21')
  assert.equal(R.weekKey(Date.parse('2026-09-27T16:00:00Z')), '2026-09-28')
})
test('13-round eligibility, exact rate ties, competition ranking, seven-day expiry', () => {
  const now = Date.parse('2026-09-23T12:00:00Z'),
    a = (uid, total, success, lastPlayedAt = now) => ({
      ...R.emptyAggregate(uid, 'all'),
      total,
      success,
      bestTimeMs: 1000,
      lastPlayedAt,
    })
  const rows = [
    a('a', 13, 13),
    a('b', 26, 26),
    a('c', 13, 12),
    a('under', 12, 12),
    a('expired', 13, 13, now - 7 * R.DAY),
  ]
  assert.deepEqual(
    R.ranked(rows, 'rate', 'all', now).map((r) => [r.uid, r.rank]),
    [
      ['a', 1],
      ['b', 1],
      ['c', 3],
    ],
  )
  assert.equal(R.ranked(rows, 'rate', 'week', now).length, 4)
  rows[4] = R.updateAggregate(rows[4], { success: false, timeMs: 300, ts: now })
  assert.equal(
    R.ranked(rows, 'rate', 'all', now).some((r) => r.uid === 'expired'),
    true,
  )
})
test('fastest time needs one correct answer, failure never improves best', () => {
  let r = R.emptyAggregate('a', 'all')
  const now = Date.now()
  r = R.updateAggregate(r, { success: false, timeMs: 1, ts: now })
  assert.equal(R.ranked([r], 'time', 'all', now).length, 0)
  r = R.updateAggregate(r, { success: true, timeMs: 2200, ts: now })
  r = R.updateAggregate(r, { success: false, timeMs: 1, ts: now })
  assert.equal(R.ranked([r], 'time', 'all', now)[0].bestTimeMs, 2200)
})
test('mistake mastery requires five consecutive correct repeats', () => {
  let book = { active: {}, ledger: {} }
  book = R.updateBook(book, cards, false, 1)
  for (let i = 0; i < 4; i++) book = R.updateBook(book, cards, true, 2 + i)
  assert.equal(Object.keys(book.active).length, 1)
  book = R.updateBook(book, cards, true, 6)
  assert.equal(Object.keys(book.active).length, 0)
  assert.equal(book.ledger['1,2,3,4'].attempts, 6)
})
test('server deals only solvable hands without replacement within a deck', () => {
  for (const high of [false, true]) {
    let deck = []
    for (let i = 0; i < 5; i++) {
      const r = R.draw(deck, high)
      assert.equal(R.validExpression(r.solution, r.cards, high), true)
      assert.equal(r.deck.length, (deck.length || 52) - 4)
      const ids = r.cards.map((c) => c.rank + c.suit)
      assert.equal(new Set(ids).size, 4)
      deck = r.deck
    }
  }
})
