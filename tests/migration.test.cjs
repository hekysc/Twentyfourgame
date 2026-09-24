const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs')
const importSource = async (p) =>
  import(
    'data:text/javascript;base64,' +
      Buffer.from(fs.readFileSync(p, 'utf8')).toString('base64')
  )
test('local migration preserves originals, merges totals and books once, without cloud calls', async () => {
  const values = new Map(),
    put = (k, v) => values.set(k, JSON.stringify(v))
  global.uni = {
    getStorageSync: (k) => values.get(k),
    setStorageSync: (k, v) => values.set(k, v),
    removeStorageSync: (k) => values.delete(k),
  }
  put('tf24_users_v1', { list: [{ id: 'a' }, { id: 'b' }] })
  const a = {
    totals: { total: 100, success: 70, fail: 30 },
    days: { '2026-09-22': { total: 2, success: 1, fail: 1 } },
    rounds: [{ id: 'same', ts: 2 }],
    agg: { bestTimeMs: 2000 },
  }
  const b = {
    totals: { total: 20, success: 10, fail: 10 },
    days: { '2026-09-22': { total: 1, success: 1, fail: 0 } },
    rounds: [{ id: 'same', ts: 1 }],
    agg: { bestTimeMs: 1000 },
  }
  put('tf24_stats_v1', { _version: 2, a, b })
  const original = values.get('tf24_stats_v1')
  put('mistakes:a', {
    active: {
      '1,2,3,4': {
        nums: [1, 2, 3, 4],
        wrong: 2,
        correct: 1,
        attempts: 3,
        lastSeenTs: 5,
      },
    },
    ledger: {},
  })
  put('mistakes:b', {
    active: {},
    ledger: {
      '1,2,3,4': {
        nums: [1, 2, 3, 4],
        wrong: 1,
        correct: 5,
        attempts: 6,
        lastSeenTs: 6,
      },
    },
  })
  const { migratePractice, readJSON } = await importSource('utils/migration.js')
  migratePractice()
  migratePractice()
  const r = readJSON('tf24_stats:practice', {})
  assert.deepEqual(r.totals, { total: 120, success: 80, fail: 40 })
  assert.equal(r.rounds.length, 2)
  assert.equal(new Set(r.rounds.map((r) => r.id)).size, 2)
  assert.equal(r.agg.bestTimeMs, 1000)
  assert.equal(values.get('tf24_stats_v1'), original)
  assert.equal(readJSON('mistakes:practice', {}).active['1,2,3,4'].attempts, 9)
  assert.ok(values.get('tf24_legacy_backup_v1'))
})
