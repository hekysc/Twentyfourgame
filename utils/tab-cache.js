import { ensureInit, getUsers, allUsersWithStats, readStatsExtended } from './store.js'

const CACHE_KEY = '__tf24_tab_cache__'

function getGlobalData() {
  try {
    const app = getApp({ allowDefault: true })
    if (app) {
      app.globalData = app.globalData || {}
      app.globalData[CACHE_KEY] = app.globalData[CACHE_KEY] || {
        warmedAt: 0,
        usersState: null,
        overviewRows: null,
        statsExt: {},
        tabBarHeight: 0,
      }
      return app.globalData[CACHE_KEY]
    }
  } catch (_) {
    /* noop */
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__tf24TabCache = globalThis.__tf24TabCache || {
      warmedAt: 0,
      usersState: null,
      overviewRows: null,
      statsExt: {},
      tabBarHeight: 0,
    }
    return globalThis.__tf24TabCache
  }
  return {
    warmedAt: 0,
    usersState: null,
    overviewRows: null,
    statsExt: {},
    tabBarHeight: 0,
  }
}

function cloneUsersState(state) {
  if (!state || typeof state !== 'object') return null
  return {
    currentId: state.currentId || '',
    list: Array.isArray(state.list) ? state.list.map(u => ({ ...u })) : [],
  }
}

function cloneOverview(list) {
  if (!Array.isArray(list)) return null
  return list.map(item => ({ ...item }))
}

function cloneStatsMap(map) {
  if (!map || typeof map !== 'object') return {}
  const cloned = {}
  for (const key of Object.keys(map)) {
    const value = map[key]
    if (value && typeof value === 'object') {
      cloned[key] = {
        totals: value.totals ? { ...value.totals } : { total: 0, success: 0, fail: 0 },
        days: value.days ? { ...value.days } : {},
        rounds: Array.isArray(value.rounds) ? value.rounds.map(r => ({ ...r })) : [],
        agg: value.agg ? { ...value.agg } : {},
      }
    }
  }
  return cloned
}

export function setTabBarHeight(heightPx) {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return
  const cache = getGlobalData()
  if (cache.tabBarHeight !== heightPx) cache.tabBarHeight = heightPx
  try {
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--tf24-tabbar-height-px', `${heightPx}px`)
    }
  } catch (_) {
    /* noop */
  }
}

export function getTabBarHeight() {
  const cache = getGlobalData()
  return Number.isFinite(cache.tabBarHeight) ? cache.tabBarHeight : 0
}

export function refreshTabCaches() {
  const cache = getGlobalData()
  try {
    ensureInit()
  } catch (_) {
    /* noop */
  }
  let usersState = null
  try {
    usersState = getUsers()
  } catch (_) {
    usersState = { list: [], currentId: '' }
  }
  let overviewRows = null
  try {
    overviewRows = allUsersWithStats()
  } catch (_) {
    overviewRows = []
  }
  const statsExt = {}
  try {
    for (const item of overviewRows || []) {
      if (!item || !item.id) continue
      try {
        statsExt[item.id] = readStatsExtended(item.id)
      } catch (_) {
        statsExt[item.id] = { totals: { total: 0, success: 0, fail: 0 }, days: {}, rounds: [], agg: {} }
      }
    }
  } catch (_) {
    /* noop */
  }

  cache.usersState = cloneUsersState(usersState) || { list: [], currentId: '' }
  cache.overviewRows = cloneOverview(overviewRows) || []
  cache.statsExt = cloneStatsMap(statsExt)
  cache.warmedAt = Date.now()
  return cache
}

export function scheduleTabWarmup(options = {}) {
  const { immediate = false, delay = 120 } = options || {}
  const run = () => {
    try { refreshTabCaches() } catch (_) {}
  }
  if (immediate) {
    run()
    return
  }
  try {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 500 })
      return
    }
  } catch (_) {
    /* noop */
  }
  setTimeout(run, Number.isFinite(delay) ? Math.max(16, delay) : 120)
}

export function getCachedUsersState() {
  const cache = getGlobalData()
  return cloneUsersState(cache.usersState)
}

export function getCachedOverviewRows() {
  const cache = getGlobalData()
  return cloneOverview(cache.overviewRows)
}

export function getCachedStatsExt(uid) {
  if (!uid) return null
  const cache = getGlobalData()
  const ext = cache.statsExt && cache.statsExt[uid]
  if (!ext) return null
  return cloneStatsMap({ [uid]: ext })[uid] || null
}

export function setCachedUsersState(state) {
  const cache = getGlobalData()
  cache.usersState = cloneUsersState(state) || { list: [], currentId: '' }
  cache.warmedAt = Date.now()
}

export function setCachedOverviewRows(rows) {
  const cache = getGlobalData()
  cache.overviewRows = cloneOverview(rows) || []
  cache.warmedAt = Date.now()
}

export function mergeCachedStatsExt(map) {
  const cache = getGlobalData()
  const incoming = cloneStatsMap(map)
  cache.statsExt = { ...(cache.statsExt || {}), ...incoming }
  cache.warmedAt = Date.now()
}

export function clearTabCache() {
  const cache = getGlobalData()
  cache.usersState = { list: [], currentId: '' }
  cache.overviewRows = []
  cache.statsExt = {}
  cache.warmedAt = 0
}
