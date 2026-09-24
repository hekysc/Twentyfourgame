import { currentIdentity, isOnline, storageScope } from './identity.js'
import {
  readJSON,
  writeJSON,
  emptyStats,
  migratePractice,
} from './migration.js'
export function ensureInit() {
  migratePractice()
}
export function getUsers() {
  const u = currentIdentity()
  return { list: [u], currentId: u.id }
}
export function getCurrentUser() {
  return currentIdentity()
}
export function listUsers() {
  return [currentIdentity()]
}
export function readStats() {
  return readJSON(`tf24_stats:${storageScope()}`, emptyStats())
}
export function readStatsExtended() {
  return readStats()
}
export function replaceOnlineStats(data) {
  if (isOnline()) writeJSON(`tf24_stats:${storageScope()}`, data)
}
export function pushRound(arg) {
  if (isOnline()) throw new Error('在线成绩只能由云端写入')
  const rec = readStats(),
    success = typeof arg === 'boolean' ? arg : !!arg.success
  const ts = Date.now(),
    day = new Date(ts + 8 * 3600000).toISOString().slice(0, 10)
  const round = {
    ...(typeof arg === 'object' ? arg : {}),
    id: `${ts}-${Math.random().toString(36).slice(2)}`,
    ts,
    success,
  }
  rec.days[day] ||= { total: 0, success: 0, fail: 0 }
  for (const counter of [rec.totals, rec.days[day]]) {
    counter.total++
    counter[success ? 'success' : 'fail']++
  }
  rec.rounds.push(round)
  if (success && Number.isFinite(round.timeMs))
    rec.agg.bestTimeMs = Math.min(rec.agg.bestTimeMs ?? Infinity, round.timeMs)
  rec.agg.currentStreak = success ? (rec.agg.currentStreak || 0) + 1 : 0
  rec.agg.longestStreak = Math.max(
    rec.agg.longestStreak || 0,
    rec.agg.currentStreak,
  )
  writeJSON(`tf24_stats:${storageScope()}`, rec)
}
export function allUsersWithStats() {
  const u = currentIdentity(),
    s = readStats(),
    t = s.totals
  return [
    {
      ...u,
      totals: t,
      winRate: t.total ? Math.round((100 * t.success) / t.total) : 0,
      ...s.agg,
    },
  ]
}
export function touchLastPlayed() {}
// Legacy avatar helpers are retained for local-only components, never for identity creation.
export function setUsers() {}
export function switchUser() {}
export function setUserAvatar() {}
export function setUserColor() {}
export function renameUser() {}
export function removeUser() {}
export function addUser() {
  throw new Error('请使用微信登录或本地练习')
}
export function resetAllData() {
  if (!isOnline()) {
    writeJSON('tf24_stats:practice', emptyStats())
    writeJSON('mistakes:practice', { active: {}, ledger: {} })
  }
}
