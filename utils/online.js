import {
  currentIdentity,
  isOnline,
  setOnlineIdentity,
} from './identity.js'
import { readJSON, writeJSON, emptyStats } from './migration.js'
import { replaceOnlineStats } from './store.js'
import { restorePrefs } from './prefs.js'
import { clearTabCache } from './tab-cache.js'
export const CLOUD_ENV = 'twentyfour-d6g4wbv3c4f226753'
let initialized = false,
  listeners = false,
  epoch = 0,
  prefsTimer = null,
  prefsChain = Promise.resolve(),
  pendingPrefs = null,
  deckOwner = '',
  deckState = null,
  activeQuestion = null,
  resultTimer = null,
  resultFlush = null,
  resultRetryDelay = 3000,
  activeSyncRequests = 0,
  syncStatus = { status: 'synced', retryable: false }
function publishSyncStatus(status, retryable = false) {
  syncStatus = { status, retryable }
  try { uni.$emit('tf24:sync-status', { ...syncStatus }) } catch (_) {}
}
export function getCloudSyncStatus() {
  return { ...syncStatus }
}
function beginSync() {
  activeSyncRequests++
  publishSyncStatus('syncing')
}
function endSync(success, retryable = false) {
  activeSyncRequests = Math.max(0, activeSyncRequests - 1)
  if (!success) publishSyncStatus('error', retryable)
  else if (activeSyncRequests === 0 && !pendingPrefs) publishSyncStatus('synced')
}
export async function retryCloudSync() {
  try { await flushPrefs() } catch (_) {}
  try { await flushOnlineResults() } catch (_) {}
}
function sdk() {
  if (typeof wx === 'undefined' || !wx.cloud)
    throw new Error('请在微信小程序中使用在线模式')
  if (!initialized) {
    wx.cloud.init({ env: CLOUD_ENV, traceUser: false })
    initialized = true
  }
  return wx.cloud
}
async function connected() {
  const r = await new Promise((resolve, reject) =>
    uni.getNetworkType({ success: resolve, fail: reject }),
  )
  if (r.networkType === 'none') throw new Error('当前无网络，请使用本地练习')
}
export async function cloudCall(action, data = {}) {
  await connected()
  const res = await sdk().callFunction({
    name: 'tf24',
    data: { action, ...data },
  })
  if (!res.result?.ok)
    throw new Error(res.result?.error || '云服务未返回有效结果')
  return res.result.data
}
function applySnapshot(snapshot, rounds) {
  const t = snapshot.total || {},
    st = emptyStats()
  st.totals = {
    total: t.total || 0,
    success: t.success || 0,
    fail: t.fail || 0,
  }
  st.agg = { bestTimeMs: t.bestTimeMs }
  st.rounds = rounds.sort((a, b) => a.ts - b.ts)
  for (const r of st.rounds) {
    const day = new Date(r.ts + 8 * 3600000).toISOString().slice(0, 10)
    const d = (st.days[day] ||= { total: 0, success: 0, fail: 0 })
    d.total++
    d[r.success ? 'success' : 'fail']++
  }
  replaceOnlineStats(st)
  writeJSON('mistakes:' + snapshot.user.id, snapshot.book)
  restorePrefs(snapshot.prefs)
  clearTabCache()
}
export async function loginOnline() {
  const pending = readJSON('tf24_void_pending', null)
  if (pending) {
    await cloudCall('void', { id: pending.id })
    uni.removeStorageSync('tf24_void_pending')
  }
  const snapshot = await cloudCall('login'),
    rounds = []
  let cursor = ''
  do {
    const page = await cloudCall('history', { cursor })
    rounds.push(...page.rows)
    cursor = page.cursor
  } while (cursor)
  setOnlineIdentity(snapshot.user)
  epoch++
  activeQuestion = null
  deckOwner = ''
  deckState = null
  applySnapshot(snapshot, rounds)
  flushOnlineResults().catch(() => {})
  return snapshot.user
}
export async function refreshOnline() {
  if (!isOnline()) return
  const stamp = epoch,
    snapshot = await cloudCall('snapshot'),
    rounds = []
  let cursor = ''
  do {
    const page = await cloudCall('history', { cursor })
    rounds.push(...page.rows)
    cursor = page.cursor
  } while (cursor)
  if (stamp !== epoch) return
  setOnlineIdentity(snapshot.user)
  activeQuestion = null
  deckOwner = ''
  deckState = null
  applySnapshot(snapshot, rounds)
  flushOnlineResults().catch(() => {})
}
export function enterPractice() {
  epoch++
  activeQuestion = null
  setOnlineIdentity(null)
  clearTabCache()
  restorePrefs(readJSON('tf24_prefs:practice', {}))
}
export function hasOnlineRound() {
  return !!activeQuestion
}
function deckKey(uid) { return `tf24_online_deck:${uid}` }
function outboxKey(uid) { return `tf24_online_outbox:${uid}` }
function loadDeckState() {
  const uid = currentIdentity().id
  if (deckOwner === uid && deckState) return deckState
  deckOwner = uid
  deckState = readJSON(deckKey(uid), { current: null, next: null })
  if (!deckState || typeof deckState !== 'object') deckState = { current: null, next: null }
  activeQuestion = null
  return deckState
}
function saveDeckState() {
  if (deckOwner && deckState) writeJSON(deckKey(deckOwner), deckState)
}
async function fetchDeckBatch(high, closeBatchId = '') {
  const batch = await cloudCall('prefetch', { high: !!high, closeBatchId })
  return { ...batch, index: 0 }
}
let prefetchPromise = null
async function ensureFollowingBatch(high, closeBatchId = '') {
  if (deckState?.next) return deckState.next
  if (!prefetchPromise) {
    prefetchPromise = fetchDeckBatch(high, closeBatchId)
      .then((batch) => {
        loadDeckState().next = batch
        saveDeckState()
        return batch
      })
      .finally(() => { prefetchPromise = null })
  }
  return prefetchPromise
}
export async function nextOnlineQuestion(high) {
  const state = loadDeckState()
  if (!state.current || state.current.index >= state.current.questions.length) {
    if (state.next) state.current = state.next
    else state.current = await ensureFollowingBatch(high, state.current?.id || '')
    state.next = null
  }
  if (!state.current || !state.current.questions?.length) throw new Error('预发题库为空，请重试')
  const batch = state.current
  const question = batch.questions[batch.index++]
  saveDeckState()
  activeQuestion = { ...question, batchId: batch.id }
  if (batch.index >= batch.questions.length) ensureFollowingBatch(high, batch.id).catch(() => {})
  return activeQuestion
}
function applyQueuedRound(event) {
  const uid = currentIdentity().id
  const key = `tf24_stats:online:${uid}`
  const st = readJSON(key, emptyStats())
  if (st.rounds.some((r) => r.id === event.questionId)) return
  const success = event.kind === 'answer'
  const ts = Date.now()
  const round = {
    id: event.questionId,
    ts,
    uid,
    success,
    timeMs: event.timeMs,
    expr: event.expr || '',
    hand: { cards: event.cards || [] },
    faceUseHigh: !!event.high,
    hintUsed: event.kind === 'hint',
    mode: event.mode,
  }
  const day = new Date(ts + 8 * 3600000).toISOString().slice(0, 10)
  st.days[day] ||= { total: 0, success: 0, fail: 0 }
  for (const counter of [st.totals, st.days[day]]) {
    counter.total++
    counter[success ? 'success' : 'fail']++
  }
  st.rounds.push(round)
  if (success) st.agg.bestTimeMs = Math.min(st.agg.bestTimeMs ?? Infinity, event.timeMs)
  writeJSON(key, st)
}
function applySyncedRound(uid, round) {
  if (!round?.id) return
  const key = `tf24_stats:online:${uid}`
  const st = readJSON(key, emptyStats())
  if (st.rounds.some((item) => item.id === round.id)) return
  const day = new Date(round.ts + 8 * 3600000).toISOString().slice(0, 10)
  st.days[day] ||= { total: 0, success: 0, fail: 0 }
  for (const counter of [st.totals, st.days[day]]) {
    counter.total++
    counter[round.success ? 'success' : 'fail']++
  }
  st.rounds.push(round)
  st.rounds.sort((a, b) => a.ts - b.ts)
  if (round.success) st.agg.bestTimeMs = Math.min(st.agg.bestTimeMs ?? Infinity, round.timeMs)
  writeJSON(key, st)
}
export function finishOnlineRound(arg, kind) {
  if (!isOnline() || !activeQuestion) throw new Error('当前没有可结算的预发题目')
  const question = activeQuestion
  const event = {
    batchId: question.batchId,
    questionId: question.id,
    kind,
    expr: arg.expr || '',
    timeMs: Math.max(1, Math.floor(Number(arg.timeMs) || 1)),
    mode: arg.mode === 'pro' ? 'pro' : 'basic',
    practice: !!arg.practice,
    mistakeKey: arg.mistakeKey || '',
    high: !!arg.high,
    cards: arg.cards || question.cards,
  }
  const uid = currentIdentity().id
  const outbox = readJSON(outboxKey(uid), [])
  if (!outbox.some((item) => item.questionId === event.questionId)) {
    outbox.push(event)
    writeJSON(outboxKey(uid), outbox)
    activeQuestion = null
    if (!event.practice) applyQueuedRound(event)
  } else {
    activeQuestion = null
  }
  if (outbox.length >= 5) flushOnlineResults().catch(() => {})
  else {
    clearTimeout(resultTimer)
    resultTimer = setTimeout(() => flushOnlineResults().catch(() => {}), 1500)
  }
  return { settled: true, success: kind === 'answer', queued: true }
}
export async function flushOnlineResults() {
  if (!isOnline() || resultFlush) return resultFlush
  clearTimeout(resultTimer)
  const uid = currentIdentity().id
  resultFlush = (async () => {
    let pending = readJSON(outboxKey(uid), [])
    while (pending.length) {
      const chunk = pending.slice(0, 13)
      beginSync()
      try {
        const response = await cloudCall('syncBatch', { results: chunk })
        const accepted = new Set((response.settled || []).filter((r) => r.settled).map((r) => r.questionId))
        const permanent = new Set((response.settled || [])
          .filter((r) => !r.settled && /过期|不属于此预发批次/.test(r.error || ''))
          .map((r) => r.questionId))
        for (const result of response.settled || []) {
          if (!result.settled) continue
          if (result.round) applySyncedRound(uid, result.round)
          if (result.book) writeJSON(`mistakes:${uid}`, result.book)
        }
        pending = pending.filter((item) => !accepted.has(item.questionId) && !permanent.has(item.questionId))
        writeJSON(outboxKey(uid), pending)
        if (accepted.size + permanent.size !== chunk.length) throw new Error('部分答题记录尚未确认')
        resultRetryDelay = 3000
        endSync(true)
        if (permanent.size) publishSyncStatus('error', false)
      } catch (e) {
        endSync(false, true)
        clearTimeout(resultTimer)
        resultTimer = setTimeout(() => flushOnlineResults().catch(() => {}), resultRetryDelay)
        resultRetryDelay = Math.min(60000, resultRetryDelay * 2)
        throw e
      }
    }
  })().finally(() => { resultFlush = null })
  return resultFlush
}
export async function saveProfile(name, avatarPath) {
  let avatar = avatarPath || ''
  if (avatar && !avatar.startsWith('cloud://')) {
    const r = await sdk().uploadFile({
      cloudPath: `avatars/${currentIdentity().id}/${Date.now()}.png`,
      filePath: avatar,
    })
    avatar = r.fileID
  }
  const user = await cloudCall('profile', { name, avatar })
  setOnlineIdentity(user)
  clearTabCache()
  return user
}
export function queuePrefs(prefs) {
  if (!isOnline()) return
  pendingPrefs = { prefs, epoch }
  publishSyncStatus('syncing')
  clearTimeout(prefsTimer)
  prefsTimer = setTimeout(() => flushPrefs().catch(() => {}), 500)
}
export async function flushPrefs() {
  clearTimeout(prefsTimer)
  const pending = pendingPrefs
  pendingPrefs = null
  if (pending) {
    beginSync()
    prefsChain = prefsChain
      .catch(() => {})
      .then(async () => {
        if (pending.epoch !== epoch || !isOnline()) return
        await cloudCall('prefs', { prefs: pending.prefs })
      })
  }
  try {
    await prefsChain
    if (pending) endSync(true)
  } catch (e) {
    if (pending) {
      if (pending.epoch === epoch && isOnline()) pendingPrefs = pending
      endSync(false, true)
    }
    throw e
  }
}
export function initializeCloudListeners() {
  if (listeners) return
  listeners = true
  uni.$on('tf24:prefs-save', queuePrefs)
  uni.onNetworkStatusChange?.((r) => {
    if (r.isConnected && isOnline()) {
      flushPrefs().catch(() => {})
      flushOnlineResults().catch(() => {})
    }
  })
}
