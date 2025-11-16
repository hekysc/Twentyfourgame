'use strict'
const auth = require('auth')
const db = uniCloud.database()
const recordCollection = db.collection('game_record')
const settingsCollection = db.collection('settings')
const $ = db.command.aggregate

const TIMEZONE_OFFSET = 8 * 60 * 60 * 1000

function pickToken(event = {}) {
  if (event.token) return event.token
  const authHeader = event.headers?.Authorization || event.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return ''
}

async function ensureLogin(event) {
  const token = pickToken(event)
  const verified = auth.verifyToken(token)
  if (!verified) {
    throw new Error('NOT_LOGIN')
  }
  return verified.uid
}

function normalizeRecord(data = {}) {
  const timeMsCandidate = Number.isFinite(data.time_ms)
    ? data.time_ms
    : Number.isFinite(data.timeMs)
    ? data.timeMs
    : Number.isFinite(data.time_spent)
    ? data.time_spent
    : 0
  return {
    puzzle: Array.isArray(data.puzzle) ? data.puzzle : [],
    success: !!data.success,
    time_spent: Number.isFinite(data.time_spent) ? data.time_spent : timeMsCandidate,
    time_ms: timeMsCandidate,
    hint_used: typeof data.hint_used === 'boolean' ? data.hint_used : !!data.hintUsed,
    retries: Number(data.retries) || 0,
    ops: Array.isArray(data.ops) ? data.ops : [],
    expr_len: Number(data.expr_len ?? data.exprLen) || 0,
    max_depth: Number(data.max_depth ?? data.maxDepth) || 0,
    face_use_high: typeof data.face_use_high === 'boolean' ? data.face_use_high : !!data.faceUseHigh,
    hand: data.hand || null,
    solutions_count: Number(data.solutions_count ?? data.solutionsCount) || 0,
    expr: data.expr || ''
  }
}

async function buildStats(uid) {
  const totals = { total: 0, success: 0, fail: 0 }
  const summary = await recordCollection
    .aggregate()
    .match({ uid })
    .group({
      _id: '$success',
      count: $.sum(1)
    })
    .end()
  summary.data.forEach(item => {
    if (item._id) totals.success = item.count
    else totals.fail = item.count
  })
  totals.total = totals.success + totals.fail

  const daysResult = await recordCollection
    .aggregate()
    .match({ uid })
    .group({
      _id: $.dateToString({
        format: '%Y-%m-%d',
        date: $.add(['$created_at', TIMEZONE_OFFSET])
      }),
      total: $.sum(1),
      success: $.sum($.cond(['$success', 1, 0]))
    })
    .sort({ _id: -1 })
    .limit(120)
    .end()

  const days = {}
  daysResult.data.forEach(item => {
    const fail = item.total - item.success
    days[item._id] = { total: item.total, success: item.success, fail }
  })

  return { totals, days }
}

async function buildExtendedStats(uid) {
  const overview = await buildStats(uid)
  const res = await recordCollection.where({ uid }).orderBy('created_at', 'desc').limit(100).get()
  const rounds = res.data.map(item => ({
    id: item._id,
    ts: item.created_at,
    success: !!item.success,
    timeMs: item.time_ms,
    hintUsed: !!item.hint_used,
    retries: item.retries || 0,
    ops: Array.isArray(item.ops) ? item.ops : [],
    exprLen: item.expr_len || 0,
    maxDepth: item.max_depth || 0,
    faceUseHigh: !!item.face_use_high,
    hand: item.hand || null,
    solutionsCount: item.solutions_count || 0,
    expr: item.expr || ''
  }))

  const agg = {}
  const successWithTime = rounds.filter(r => r.success && Number.isFinite(r.timeMs) && r.timeMs > 0)
  if (successWithTime.length > 0) {
    agg.bestTimeMs = Math.min(...successWithTime.map(r => r.timeMs))
  }

  let currentStreak = 0
  for (const round of rounds) {
    if (round.success) currentStreak += 1
    else break
  }
  agg.currentStreak = currentStreak

  let streak = 0
  let longestStreak = 0
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].success) {
      streak += 1
      if (streak > longestStreak) {
        longestStreak = streak
      }
    } else {
      streak = 0
    }
  }
  agg.longestStreak = longestStreak

  return { ...overview, rounds, agg }
}

function migrationKey(uid) {
  return `migration_${uid}`
}

async function getMigrationStatus(uid) {
  const key = migrationKey(uid)
  const res = await settingsCollection.doc(key).get()
  const record = res.data && res.data[0]
  if (!record) {
    return { completed: false }
  }
  const value = record.value || {}
  return {
    completed: !!value.completed,
    migrated_at: value.migrated_at || record.updated_at || null
  }
}

async function markMigrationComplete(uid) {
  const key = migrationKey(uid)
  const migratedAt = Date.now()
  await settingsCollection.doc(key).set({
    key,
    value: { completed: true, migrated_at: migratedAt },
    description: 'local data migration',
    updated_at: migratedAt,
    uid
  })
  return { completed: true, migrated_at: migratedAt }
}

exports.main = async (event = {}, context) => {
  const action = event.action || 'listRecords'
  const payload = event.data || {}
  try {
    const uid = await ensureLogin(event)
    if (action === 'listRecords') {
      const { limit = 20 } = payload
      const res = await recordCollection.where({ uid }).orderBy('created_at', 'desc').limit(limit).get()
      return { code: 0, list: res.data }
    }
    if (action === 'saveRecord') {
      const record = normalizeRecord(payload)
      await recordCollection.add({
        uid,
        ...record,
        created_at: Date.now()
      })
      return { code: 0 }
    }
    if (action === 'getStatsSummary') {
      const stats = await buildStats(uid)
      return { code: 0, stats }
    }
    if (action === 'getStatsExtended') {
      const stats = await buildExtendedStats(uid)
      return { code: 0, stats }
    }
    if (action === 'resetRecords') {
      await recordCollection.where({ uid }).remove()
      return { code: 0 }
    }
    if (action === 'getMigrationStatus') {
      const migration = await getMigrationStatus(uid)
      return { code: 0, migration }
    }
    if (action === 'markMigrationComplete') {
      const migration = await markMigrationComplete(uid)
      return { code: 0, migration }
    }
    return { code: 404, message: 'UNKNOWN_ACTION' }
  } catch (err) {
    if (err.message === 'NOT_LOGIN') {
      return { code: 401, message: 'NOT_LOGIN' }
    }
    return { code: 500, message: err.message }
  }
}
