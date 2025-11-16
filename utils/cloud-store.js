import { getSession, clearSession, saveSession } from './auth.js'

const CACHE_USER_KEY = 'tf24_cache_user'
const CACHE_STATS_KEY = 'tf24_cache_stats'
const CACHE_EXPIRY = 5 * 60 * 1000

function setCache(key, data) {
  try {
    uni.setStorageSync(key, {
      data,
      timestamp: Date.now()
    })
  } catch (err) {
    console.warn('Cache set failed:', err)
  }
}

function getCache(key) {
  try {
    const cached = uni.getStorageSync(key)
    if (!cached || !cached.timestamp) return null
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
      uni.removeStorageSync(key)
      return null
    }
    return cached.data
  } catch (err) {
    return null
  }
}

function clearUserCache() {
  try {
    uni.removeStorageSync(CACHE_USER_KEY)
  } catch (err) {}
}

function clearStatsCache() {
  try {
    uni.removeStorageSync(CACHE_STATS_KEY)
  } catch (err) {}
}

function clearCache() {
  clearUserCache()
  clearStatsCache()
}

function defaultStats() {
  return {
    totals: { total: 0, success: 0, fail: 0 },
    days: {}
  }
}

function defaultExtendedStats() {
  return {
    ...defaultStats(),
    rounds: [],
    agg: {}
  }
}

function getCurrentUserId() {
  const session = getSession()
  return session.user?._id || ''
}

function requireToken() {
  const { token } = getSession()
  if (!token) {
    throw new Error('用户未登录')
  }
  return token
}

async function callUserFunction(action, payload = {}) {
  const token = requireToken()
  const { result } = await uniCloud.callFunction({
    name: 'user',
    data: {
      action,
      token,
      data: payload
    }
  })
  if (!result) {
    throw new Error('USER_FUNCTION_EMPTY')
  }
  if (result.code && result.code !== 0) {
    throw new Error(result.message || `USER_FUNCTION_${action}_FAILED`)
  }
  return result
}

async function callGameFunction(action, payload = {}) {
  const token = requireToken()
  const { result } = await uniCloud.callFunction({
    name: 'game',
    data: {
      action,
      token,
      data: payload
    }
  })
  if (!result) {
    throw new Error('GAME_FUNCTION_EMPTY')
  }
  if (result.code && result.code !== 0) {
    throw new Error(result.message || `GAME_FUNCTION_${action}_FAILED`)
  }
  return result
}

export async function ensureInit() {
  const session = getSession()
  if (!session.token) {
    clearCache()
  }
}

export async function getCurrentUser() {
  const session = getSession()
  const userId = session.user?._id
  if (!userId) {
    return null
  }

  const cached = getCache(CACHE_USER_KEY)
  if (cached && cached._id === userId) {
    return cached
  }

  try {
    const res = await callUserFunction('getProfile')
    const user = res.user || session.user
    if (user) {
      setCache(CACHE_USER_KEY, user)
      saveSession({ token: session.token, user })
      return user
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
  }
  return session.user || null
}

export async function updateUserProfile(userData = {}) {
  const session = getSession()
  if (!session.token) {
    throw new Error('用户未登录')
  }
  try {
    const res = await callUserFunction('updateProfile', userData)
    if (res.user) {
      saveSession({ token: session.token, user: res.user })
      setCache(CACHE_USER_KEY, res.user)
      return res.user
    }
    return null
  } catch (err) {
    console.error('更新用户信息失败:', err)
    throw err
  }
}

export async function setUserAvatar(avatarUrl) {
  return await updateUserProfile({ avatar_url: avatarUrl })
}

export async function setUserNickname(nickname) {
  return await updateUserProfile({ nickname })
}

export async function setUserColor(color) {
  return await updateUserProfile({ settings: { color } })
}

export async function pushRound(gameData) {
  const userId = getCurrentUserId()
  if (!userId) {
    throw new Error('用户未登录')
  }

  const isBool = typeof gameData === 'boolean'
  const success = isBool ? gameData : !!gameData?.success
  const timeMs = isBool ? undefined : gameData?.timeMs

  const payload = {
    success,
    time_ms: Number.isFinite(timeMs) ? timeMs : undefined,
    hint_used: isBool ? false : !!gameData?.hintUsed,
    retries: isBool ? 0 : Number(gameData?.retries) || 0,
    ops: isBool ? [] : (Array.isArray(gameData?.ops) ? gameData.ops : []),
    expr_len: isBool ? 0 : Number(gameData?.exprLen) || 0,
    max_depth: isBool ? 0 : Number(gameData?.maxDepth) || 0,
    face_use_high: isBool ? false : !!gameData?.faceUseHigh,
    hand: isBool ? null : (gameData?.hand || null),
    solutions_count: isBool ? 0 : Number(gameData?.solutionsCount) || 0,
    expr: isBool ? '' : (gameData?.expr || '')
  }

  if (!isBool) {
    payload.puzzle = Array.isArray(gameData?.puzzle) ? gameData.puzzle : []
  }

  try {
    await callGameFunction('saveRecord', payload)
    clearStatsCache()
    return payload
  } catch (err) {
    console.error('保存游戏记录失败:', err)
    throw err
  }
}

export async function readStats(userId) {
  const uid = userId || getCurrentUserId()
  if (!uid) {
    return defaultStats()
  }

  const cached = getCache(CACHE_STATS_KEY)
  if (cached && cached.userId === uid) {
    return cached.stats
  }

  try {
    const res = await callGameFunction('getStatsSummary')
    const stats = res.stats || defaultStats()
    setCache(CACHE_STATS_KEY, { userId: uid, stats })
    return stats
  } catch (err) {
    console.error('获取统计数据失败:', err)
    return defaultStats()
  }
}

export async function readStatsExtended(userId) {
  const uid = userId || getCurrentUserId()
  if (!uid) {
    return defaultExtendedStats()
  }

  try {
    const res = await callGameFunction('getStatsExtended')
    if (res.stats) {
      const stats = res.stats
      return {
        totals: stats.totals || defaultStats().totals,
        days: stats.days || {},
        rounds: Array.isArray(stats.rounds) ? stats.rounds : [],
        agg: stats.agg || {}
      }
    }
  } catch (err) {
    console.error('获取扩展统计失败:', err)
  }
  return defaultExtendedStats()
}

export async function allUsersWithStats() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return []
  }
  const statsExt = await readStatsExtended(currentUser._id)
  const totals = statsExt.totals || defaultStats().totals
  const winRate = totals.total ? Math.round(100 * (totals.success / totals.total)) : 0
  const agg = statsExt.agg || {}
  return [{
    id: currentUser._id,
    name: currentUser.nickname || '微信用户',
    totals,
    winRate,
    bestTimeMs: agg.bestTimeMs,
    currentStreak: agg.currentStreak || 0,
    longestStreak: agg.longestStreak || 0
  }]
}

export async function resetUserData() {
  const uid = getCurrentUserId()
  if (!uid) {
    throw new Error('用户未登录')
  }
  try {
    await callGameFunction('resetRecords')
    clearCache()
    return true
  } catch (err) {
    console.error('重置用户数据失败:', err)
    throw err
  }
}

export async function migrateLocalData() {
  const response = { migrated: false, message: '' }
  try {
    const status = await callGameFunction('getMigrationStatus')
    if (status.migration?.completed) {
      return { migrated: true, message: '已经迁移过本地数据' }
    }
  } catch (err) {
    console.warn('查询迁移状态失败:', err)
  }

  try {
    const res = await callGameFunction('markMigrationComplete')
    response.migrated = !!res.migration?.completed
    response.message = response.migrated ? '本地数据迁移完成' : '数据迁移未完成'
    return response
  } catch (err) {
    console.error('数据迁移失败:', err)
    return { migrated: false, message: '数据迁移失败', error: err.message }
  }
}

export function resetAllData() {
  clearSession()
  clearCache()
  try {
    uni.clearStorageSync()
  } catch (err) {}
}
