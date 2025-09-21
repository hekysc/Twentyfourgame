const PREFS_KEY = 'tf24_prefs_v1'

function readPrefs() {
  try {
    const raw = uni.getStorageSync(PREFS_KEY)
    if (!raw) return {}
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) || {} } catch (_) { return {} }
    }
    return raw && typeof raw === 'object' ? raw : {}
  } catch (_) {
    return {}
  }
}

function writePrefs(data) {
  try {
    uni.setStorageSync(PREFS_KEY, JSON.stringify(data || {}))
  } catch (_) { /* noop */ }
}

function normalizePrefs(prefs) {
  const p = prefs && typeof prefs === 'object' ? { ...prefs } : {}
  if (!p || typeof p !== 'object') return {}
  if (p.lastMode !== 'pro' && p.lastMode !== 'basic') {
    p.lastMode = 'basic'
  }
  if (!Number.isFinite(p.lastHintTs)) {
    p.lastHintTs = 0
  }
  if (!p.avatarMeta || typeof p.avatarMeta !== 'object') {
    p.avatarMeta = {}
  }
  return p
}

export function getPrefs() {
  return normalizePrefs(readPrefs())
}

function updatePrefs(updater) {
  const cur = getPrefs()
  const next = typeof updater === 'function' ? updater(cur) : { ...cur, ...(updater || {}) }
  writePrefs(next)
  return next
}

export function getLastMode() {
  const prefs = getPrefs()
  return prefs.lastMode === 'pro' ? 'pro' : 'basic'
}

export function setLastMode(mode) {
  updatePrefs(p => ({ ...p, lastMode: mode === 'pro' ? 'pro' : 'basic' }))
}

export function getLastHintTimestamp() {
  const prefs = getPrefs()
  return Number.isFinite(prefs.lastHintTs) ? prefs.lastHintTs : 0
}

export function setLastHintTimestamp(ts) {
  const stamp = Number.isFinite(ts) ? Math.max(0, Math.floor(ts)) : Date.now()
  updatePrefs(p => ({ ...p, lastHintTs: stamp }))
}

export function clearLastHintTimestamp() {
  updatePrefs(p => ({ ...p, lastHintTs: 0 }))
}

export function readAvatarMeta(userId) {
  if (!userId) return null
  const prefs = getPrefs()
  const meta = prefs.avatarMeta || {}
  const data = meta[userId]
  if (!data || typeof data !== 'object') return null
  const uri = typeof data.uri === 'string' ? data.uri : ''
  const lastModified = Number.isFinite(data.lastModified) ? data.lastModified : 0
  return { uri, lastModified }
}

export function writeAvatarMeta(userId, meta) {
  if (!userId) return
  updatePrefs(p => {
    const avatarMeta = { ...(p.avatarMeta || {}) }
    if (!meta || !meta.uri) {
      delete avatarMeta[userId]
    } else {
      avatarMeta[userId] = {
        uri: meta.uri,
        lastModified: Number.isFinite(meta.lastModified) ? meta.lastModified : Date.now(),
      }
    }
    return { ...p, avatarMeta }
  })
}

export function clearAvatarMeta(userId) {
  writeAvatarMeta(userId, null)
}
