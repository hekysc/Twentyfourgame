const { test } = require('node:test')
const assert = require('node:assert/strict')

function setupCloud(responses) {
  const store = new Map()
  const calls = []
  global.uni = {
    getStorageSync: (key) => store.get(key),
    setStorageSync: (key, value) => store.set(key, value),
    removeStorageSync: (key) => store.delete(key),
    getNetworkType: ({ success }) => success({ networkType: 'wifi' }),
    $emit() {}, $on() {}, onNetworkStatusChange() {},
  }
  global.wx = { cloud: {
    init() {},
    callFunction: async ({ data }) => {
      calls.push(data)
      const result = await responses(data)
      return { result: { ok: true, data: result } }
    },
  } }
  return { store, calls }
}

test('online hands are taken from a cached deck batch and queued results retry without blocking play', async () => {
  let attempts = 0
  const q = (id, remaining) => ({ id, cards: [1, 2, 3, 4].map((rank) => ({ rank, suit: 'S' })), high: false, remaining })
  const first = { id: 'deck-a', questions: [q('q1', 48), q('q2', 0)] }
  const second = { id: 'deck-b', questions: [q('q3', 48), q('q4', 0)] }
  const { store, calls } = setupCloud(async (request) => {
    if (request.action === 'prefetch') return request.closeBatchId ? second : first
    if (request.action === 'syncBatch') {
      attempts++
      if (attempts === 1) throw new Error('network down')
      return { settled: request.results.map((r) => ({ questionId: r.questionId, settled: true })) }
    }
    throw new Error(`unexpected action ${request.action}`)
  })
  const online = await import(`../utils/online.js?batch-test=${Date.now()}`)
  const identity = await import('../utils/identity.js')
  identity.setOnlineIdentity({ id: 'test-user', name: '玩家' })
  const one = await online.nextOnlineQuestion(false)
  assert.equal(one.id, 'q1')
  assert.equal(calls.filter((x) => x.action === 'prefetch').length, 1)
  const queued = online.finishOnlineRound({ success: true, expr: '(1+3)×(2+4)', timeMs: 1200, mode: 'pro', high: false }, 'answer')
  assert.equal(queued.queued, true)
  assert.equal(calls.filter((x) => x.action === 'syncBatch').length, 0)
  const outboxKey = 'tf24_online_outbox:test-user'
  assert.equal(JSON.parse(store.get(outboxKey)).length, 1)
  await assert.rejects(online.flushOnlineResults(), /network down/)
  assert.equal(JSON.parse(store.get(outboxKey)).length, 1)
  await online.flushOnlineResults()
  assert.equal(JSON.parse(store.get(outboxKey)).length, 0)
  const two = await online.nextOnlineQuestion(false)
  assert.equal(two.id, 'q2')
  const three = await online.nextOnlineQuestion(false)
  assert.equal(three.id, 'q3')
  assert.equal(calls.filter((x) => x.action === 'prefetch').length, 2)
})
