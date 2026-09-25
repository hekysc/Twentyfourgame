import {
  currentIdentity,
  isOnline,
  setOnlineIdentity,
  storageScope,
} from './identity.js'
import { readJSON, writeJSON, emptyStats } from './migration.js'
import { replaceOnlineStats } from './store.js'
import { restorePrefs } from './prefs.js'
import { clearTabCache } from './tab-cache.js'
export const CLOUD_ENV = 'twentyfour-d6g4wbv3c4f226753'
let initialized = false,
  listeners = false,
  currentRound = null,
  epoch = 0,
  prefsTimer = null,
  prefsChain = Promise.resolve(),
  pendingPrefs = null,
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
  currentRound = null
  applySnapshot(snapshot, rounds)
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
  applySnapshot(snapshot, rounds)
}
export function enterPractice() {
  if (currentRound && isOnline())
    cloudCall('void', { id: currentRound.id }).catch(() => {})
  epoch++
  currentRound = null
  setOnlineIdentity(null)
  clearTabCache()
  restorePrefs(readJSON('tf24_prefs:practice', {}))
}
export function hasOnlineRound() {
  return !!currentRound
}
export async function beginOnlineRound(options) {
  const stamp = epoch
  beginSync()
  try {
    const r = await cloudCall('start', options)
    if (stamp !== epoch) throw new Error('在线题目已作废')
    currentRound = r
    endSync(true)
    return r
  } catch (e) {
    endSync(false)
    throw e
  }
}
export async function finishOnlineRound(arg, kind) {
  if (!isOnline() || !currentRound) throw new Error('请重新开始在线题目')
  const stamp = epoch,
    id = currentRound.id
  beginSync()
  let res
  try {
    res = await cloudCall('finish', { id, kind, expr: arg.expr || '' })
    if (stamp !== epoch) throw new Error('网络中断，当局不计入统计')
  } catch (e) {
    endSync(false)
    throw e
  }
  endSync(true)
  if (res.settled === false) return res
  const uid = currentIdentity().id
  writeJSON('mistakes:' + uid, res.book)
  if (res.round) {
    const st = readJSON(`tf24_stats:${storageScope()}`, emptyStats())
    if (!st.rounds.some((r) => r.id === res.round.id)) {
      st.rounds.push(res.round)
      const day = new Date(res.round.ts + 8 * 3600000)
          .toISOString()
          .slice(0, 10),
        d = (st.days[day] ||= { total: 0, success: 0, fail: 0 })
      d.total++
      d[res.round.success ? 'success' : 'fail']++
    }
    st.totals = {
      total: res.total.total,
      success: res.total.success,
      fail: res.total.fail,
    }
    st.agg.bestTimeMs = res.total.bestTimeMs
    replaceOnlineStats(st)
  }
  clearTabCache()
  return res
}
export async function cancelOnlineRound() {
  const r = currentRound
  currentRound = null
  if (r && isOnline()) await cloudCall('void', { id: r.id })
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
let offlinePrompt = false
export function handleConnectionFailure(error) {
  if (!isOnline() || offlinePrompt) return
  offlinePrompt = true
  const r = currentRound
  currentRound = null
  // An unfinished server session is invalidated before a later login starts a fresh one.
  if (r) writeJSON('tf24_void_pending', r)
  epoch++
  setOnlineIdentity(null)
  clearTabCache()
  uni.showModal({
    title: '在线题目已中止',
    content:
      '当前题目不计入统计。可进入本地练习，联网后重新登录并开局。' +
      (error?.message ? '\n' + error.message : ''),
    showCancel: false,
    confirmText: '返回入口',
    complete: () => {
      offlinePrompt = false
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}
export function initializeCloudListeners() {
  if (listeners) return
  listeners = true
  uni.$on('tf24:prefs-save', queuePrefs)
  uni.onNetworkStatusChange?.((r) => {
    if (!r.isConnected && isOnline()) handleConnectionFailure()
  })
}
