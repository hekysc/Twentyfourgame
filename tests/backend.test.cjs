const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  crypto = require('node:crypto')
const R = require('../cloudfunctions/tf24/rules'),
  { solve24 } = require('../cloudfunctions/tf24/solver')
function harness() {
  let tables = {},
    ctx = { OPENID: 'owner', APPID: 'wx58faf81d08ca037c' }
  const uid = () =>
    crypto
      .createHash('sha256')
      .update(ctx.APPID + ':' + ctx.OPENID)
      .digest('hex')
      .slice(0, 32)
  function collection(name) {
    tables[name] ||= {}
    return {
      where(condition) {
        let limit = 100
        return {
          orderBy() {
            return this
          },
          limit(n) {
            limit = n
            return this
          },
          async get() {
            return {
              data: Object.entries(tables[name])
                .map(([id, x]) => ({ _id: id, ...structuredClone(x) }))
                .filter((r) =>
                  Object.entries(condition).every(([k, v]) =>
                    v?.gt !== undefined ? r[k] > v.gt : r[k] === v,
                  ),
                )
                .sort((a, b) => a._id.localeCompare(b._id))
                .slice(0, limit),
            }
          },
        }
      },
      doc(id) {
        return {
          async get() {
            if (!tables[name][id]) throw Error('missing')
            return { data: { _id: id, ...structuredClone(tables[name][id]) } }
          },
          async set({ data }) {
            tables[name][id] = structuredClone(data)
          },
          async update({ data }) {
            Object.assign(tables[name][id], structuredClone(data))
          },
          async remove() {
            delete tables[name][id]
          },
        }
      },
      async add({ data }) {
        const { _id, ...rest } = data
        if (tables[name][_id]) throw Error('duplicate')
        tables[name][_id] = structuredClone(rest)
      },
    }
  }
  const db = {
    collection,
    command: { gt: (v) => ({ gt: v }) },
    async runTransaction(fn) {
      const old = structuredClone(tables)
      try {
        return await fn(db)
      } catch (e) {
        tables = old
        throw e
      }
    },
  }
  const cloud = {
    init() {},
    database: () => db,
    getWXContext: () => ctx,
    DYNAMIC_CURRENT_ENV: 'env',
  }
  const sandbox = {
    exports: {},
    require: (n) =>
      n === 'wx-server-sdk' ? cloud : n === './rules' ? R : require(n),
    console: { error() {} },
    process: { env: {} },
  }
  vm.runInNewContext(
    fs.readFileSync('cloudfunctions/tf24/index.js', 'utf8'),
    sandbox,
  )
  return {
    call: async (data) =>
      JSON.parse(JSON.stringify(await sandbox.exports.main(data))),
    tables: () => tables,
    uid,
    setUser: (id) => {
      ctx.OPENID = id
    },
  }
}
test('server rejects unauthenticated invocations', async () => {
  const h = harness()
  h.setUser('')
  assert.equal((await h.call({ action: 'login' })).ok, false)
})
test('duplicate finish is idempotent; server ignores forged score, time and owner', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const r = (await h.call({ action: 'start', high: true })).data
  const expr = solve24(r.cards.map((c) => c.rank))
  const input = {
    action: 'finish',
    id: r.id,
    kind: 'answer',
    expr,
    timeMs: -1,
    success: true,
    uid: 'attacker',
  }
  const a = await h.call(input),
    b = await h.call(input)
  assert.equal(a.ok, true)
  assert.equal(a.data.success, true)
  assert.equal(b.data.total.total, 1)
  assert.ok(a.data.round.timeMs >= 1)
  assert.equal(Object.keys(h.tables().tf24_rounds).length, 1)
  assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 1)
})
test('prefetch issues one 52-card pack locally consumable in up to thirteen hands', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const batch = (await h.call({ action: 'prefetch', high: true })).data
  assert.ok(batch.questions.length > 0 && batch.questions.length <= 13)
  assert.equal(batch.questions[0].remaining, 48)
  assert.equal(batch.questions.at(-1).remaining, 0)
  const allCards = batch.questions.flatMap((q) => q.cards.map((c) => `${c.rank}${c.suit}`))
  assert.equal(new Set(allCards).size, allCards.length)
  assert.ok(allCards.length <= 52)
  for (const q of batch.questions) {
    assert.equal(R.validExpression(solve24(q.cards.map((c) => c.rank > 10 ? 1 : c.rank)), q.cards, false), true)
    assert.equal(R.validExpression(solve24(q.cards.map((c) => c.rank)), q.cards, true), true)
  }
  const resumed = (await h.call({ action: 'prefetch' })).data
  assert.equal(resumed.id, batch.id)
})
test('queued results are server-rechecked and idempotent; supplied client time is the recorded time', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const batch = (await h.call({ action: 'prefetch', high: true })).data
  const q = batch.questions[0]
  const bad = await h.call({ action: 'syncBatch', results: [{
    batchId: batch.id, questionId: q.id, kind: 'answer', expr: '24', timeMs: 3,
  }] })
  assert.equal(bad.data.settled[0].settled, false)
  assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 0)
  const expr = solve24(q.cards.map((c) => c.rank > 10 ? 1 : c.rank))
  const entry = { batchId: batch.id, questionId: q.id, kind: 'answer', expr, timeMs: 2345, high: false }
  const result = await h.call({ action: 'syncBatch', results: [entry] })
  assert.equal(result.data.settled[0].success, true)
  assert.equal(result.data.settled[0].round.timeMs, 2345)
  await h.call({ action: 'syncBatch', results: [entry] })
  assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 1)
  assert.equal(Object.keys(h.tables().tf24_rounds).length, 1)
})
test('closing a deck keeps it syncable during grace period and expiry cleanup removes its question data', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const first = (await h.call({ action: 'prefetch' })).data
  const next = (await h.call({ action: 'prefetch', closeBatchId: first.id })).data
  assert.notEqual(next.id, first.id)
  assert.equal(h.tables().tf24_question_batches[first.id].status, 'closed')
  h.tables().tf24_question_batches[first.id].expiresAt = Date.now() - 1
  await h.call({ action: 'prefetch' })
  assert.equal(h.tables().tf24_question_batches[first.id], undefined)
})
test('void, superseded sessions and wrong answers cannot become successful scores', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  let r = (await h.call({ action: 'start' })).data
  await h.call({ action: 'void', id: r.id })
  assert.equal(
    (await h.call({ action: 'finish', id: r.id, kind: 'answer', expr: '24' }))
      .ok,
    false,
  )
  r = (await h.call({ action: 'start' })).data
  await h.call({ action: 'start' })
  assert.equal(
    (await h.call({ action: 'finish', id: r.id, kind: 'skip' })).ok,
    false,
  )
  r = (await h.call({ action: 'start' })).data
  const bad = await h.call({
    action: 'finish',
    id: r.id,
    kind: 'answer',
    expr: '24',
    success: true,
  })
  assert.equal(bad.data.success, false)
  assert.equal(bad.data.settled, false)
  assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 0)
  assert.equal(h.tables().tf24_sessions[h.uid()].status, 'open')
})
test('mistake repeats update mastery only; history and rankings remain unchanged', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const r = (await h.call({ action: 'start', high: true })).data
  await h.call({ action: 'finish', id: r.id, kind: 'skip' })
  const key = r.cards
    .map((c) => c.rank)
    .sort((a, b) => a - b)
    .join(',')
  for (let i = 0; i < 5; i++) {
    const repeat = (
      await h.call({
        action: 'start',
        practice: true,
        mistakeKey: key,
        high: true,
      })
    ).data
    const a = await h.call({
      action: 'finish',
      id: repeat.id,
      kind: 'answer',
      expr: solve24(repeat.cards.map((c) => c.rank)),
    })
    assert.equal(a.data.round, null)
  }
  assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 1)
  assert.equal(
    Object.keys(h.tables().tf24_users[h.uid()].book.active).length,
    0,
  )
  assert.equal(Object.keys(h.tables().tf24_rounds).length, 1)
})
test('leaderboard masks other names, omits avatars and ids, and includes own full name', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const owner = h.uid()
  h.tables().tf24_users[owner].name = '张三'
  h.setUser('other')
  await h.call({ action: 'login' })
  const other = h.uid()
  h.tables().tf24_users[other].name = '李四'
  for (const id of [owner, other])
    Object.assign(h.tables().tf24_stats[id + '_all'], {
      total: 13,
      success: 13,
      bestTimeMs: 1000,
      lastPlayedAt: Date.now(),
    })
  h.setUser('owner')
  const r = await h.call({ action: 'leaderboard', metric: 'rate' })
  assert.equal(r.data.rows.length, 2)
  assert.equal(r.data.me.name, '张三')
  const stranger = r.data.rows.find((x) => !x.isMe)
  assert.equal(stranger.name, '李*')
  assert.equal(stranger.uid, undefined)
  assert.equal(stranger.avatar, undefined)
  assert.equal(r.data.rows[0].rank, 1)
  assert.equal(r.data.rows[1].rank, 1)
})

for (const mode of ['basic', 'pro']) {
  test(`${mode}: wrong attempts and timeout leave the round open; a late correct answer settles once`, async () => {
    const h = harness()
    await h.call({ action: 'login' })
    const r = (await h.call({ action: 'start', high: true, mode })).data
    h.tables().tf24_sessions[h.uid()].startedAt = Date.now() - 130000
    for (const kind of ['answer', 'answer', 'timeout']) {
      const response = await h.call({ action: 'finish', id: r.id, kind, expr: '24' })
      assert.equal(response.data.settled, false)
      assert.equal(h.tables().tf24_stats[h.uid() + '_all'].total, 0)
      assert.equal(Object.keys(h.tables().tf24_users[h.uid()].book.active).length, 0)
      assert.equal(h.tables().tf24_sessions[h.uid()].status, 'open')
    }
    const result = await h.call({ action: 'finish', id: r.id, kind: 'answer', expr: solve24(r.cards.map(c => c.rank)) })
    assert.equal(result.data.success, true)
    assert.equal(result.data.settled, true)
    assert.ok(result.data.round.timeMs >= 130000)
    assert.equal(result.data.total.total, 1)
    assert.equal(result.data.total.fail, 0)
    assert.equal((await h.call({ action: 'finish', id: r.id, kind: 'skip' })).data.total.total, 1)
  })
}

test('view answer then skip or solve remains one failed round with its original time', async () => {
  const h = harness()
  await h.call({ action: 'login' })
  const r = (await h.call({ action: 'start', high: true })).data
  const hint = (await h.call({ action: 'finish', id: r.id, kind: 'hint' })).data
  for (const kind of ['skip', 'answer', 'hint']) {
    const response = (await h.call({ action: 'finish', id: r.id, kind, expr: solve24(r.cards.map(c => c.rank)) })).data
    assert.equal(response.success, false)
    assert.equal(response.total.total, 1)
    assert.equal(response.total.fail, 1)
    assert.equal(response.round.timeMs, hint.round.timeMs)
  }
})
