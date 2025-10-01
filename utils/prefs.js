const PREFS_KEY = 'tf24_prefs_v2'
const LEGACY_PREFS_KEY = 'tf24_prefs_v1'

const RANK_MODES = {
  'jqk-1': { rankMode: 'jqk-1', ranks: { A: 1, J: 1, Q: 1, K: 1 } },
  'jqk-11-12-13': { rankMode: 'jqk-11-12-13', ranks: { A: 1, J: 11, Q: 12, K: 13 } },
}

const DEFAULT_PREFS = {
  lastMode: 'basic',
  lastHintTs: 0,
  avatarMeta: {},
  rankMode: 'jqk-11-12-13',
  ranks: { ...RANK_MODES['jqk-11-12-13'].ranks },
  deckSource: 'regular',
  mixWeight: 50,
  haptics: true,
  sfx: true,
  reducedMotion: false,
  rankMigrationNotice: false,
}

function readJson(key) {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch (_) { return null }
    }
    return raw && typeof raw === 'object' ? raw : null
  } catch (_) {
    return null
  }
}

function writePrefs(data) {
  try {
    uni.setStorageSync(PREFS_KEY, JSON.stringify(data || {}))
  } catch (_) { /* noop */ }
}

function deriveRanks(mode) {
  const info = RANK_MODES[mode]
  if (info) return { ...info.ranks }
  return { ...RANK_MODES['jqk-11-12-13'].ranks }
}

function normalizeDeckSource(value) {
  if (value === 'mistakes' || value === 'mix') return value
  return 'regular'
}

function normalizePrefs(raw) {
  const merged = { ...DEFAULT_PREFS, ...(raw || {}) }
  merged.lastMode = merged.lastMode === 'pro' ? 'pro' : 'basic'
  merged.lastHintTs = Number.isFinite(merged.lastHintTs) ? merged.lastHintTs : 0
  merged.avatarMeta = merged.avatarMeta && typeof merged.avatarMeta === 'object' ? merged.avatarMeta : {}
  merged.rankMode = RANK_MODES[merged.rankMode] ? merged.rankMode : 'jqk-11-12-13'
  merged.ranks = deriveRanks(merged.rankMode)
  merged.deckSource = normalizeDeckSource(merged.deckSource)
  merged.mixWeight = Number.isFinite(merged.mixWeight) ? Math.min(100, Math.max(0, Math.round(merged.mixWeight))) : 50
  merged.haptics = !!merged.haptics
  merged.sfx = !!merged.sfx
  merged.reducedMotion = !!merged.reducedMotion
  merged.rankMigrationNotice = !!merged.rankMigrationNotice
  return merged
}

function readLegacyFaceRanks() {
  const keys = ['tf24_face_ranks_v1', 'tf24_face_ranks']
  for (let i = 0; i < keys.length; i++) {
    const val = readJson(keys[i])
    if (val && typeof val === 'object') {
      const ranks = {
        J: Number(val.J),
        Q: Number(val.Q),
        K: Number(val.K),
      }
      const values = [ranks.J, ranks.Q, ranks.K].filter(n => Number.isFinite(n))
      if (values.length === 3) {
        return ranks
      }
    }
  }
  return null
}

function detectLegacyRankMode() {
  try {
    const session = readJson('tf24_game_session_v1')
    if (session && typeof session.faceUseHigh === 'boolean') {
      return session.faceUseHigh ? 'jqk-11-12-13' : 'jqk-1'
    }
  } catch (_) {}
  return 'jqk-11-12-13'
}

function migrateLegacyPrefs() {
  const legacy = readJson(PREFS_KEY) || readJson(LEGACY_PREFS_KEY) || {}
  const merged = { ...DEFAULT_PREFS, ...legacy }
  const faceRanks = readLegacyFaceRanks()
  let migrationNotice = false
  if (faceRanks) {
    const allowedSets = [
      RANK_MODES['jqk-1'].ranks,
      RANK_MODES['jqk-11-12-13'].ranks,
    ]
    const matchesAllowed = allowedSets.some(set => set.J === faceRanks.J && set.Q === faceRanks.Q && set.K === faceRanks.K)
    if (!matchesAllowed) {
      migrationNotice = true
    }
  }
  merged.rankMode = migrationNotice ? 'jqk-11-12-13' : detectLegacyRankMode()
  merged.rankMigrationNotice = migrationNotice
  const normalized = normalizePrefs(merged)
  writePrefs(normalized)
  try { uni.removeStorageSync(LEGACY_PREFS_KEY) } catch (_) {}
  return normalized
}

let cachedPrefs = null

function readPrefs() {
  if (cachedPrefs) return cachedPrefs
  const stored = readJson(PREFS_KEY)
  if (stored) {
    cachedPrefs = normalizePrefs(stored)
    writePrefs(cachedPrefs)
    return cachedPrefs
  }
  cachedPrefs = migrateLegacyPrefs()
  return cachedPrefs
}

function setPrefs(data) {
  cachedPrefs = normalizePrefs(data)
  writePrefs(cachedPrefs)
  return cachedPrefs
}

export function getPrefs() {
  return { ...readPrefs() }
}

function updatePrefs(updater) {
  const current = readPrefs()
  const next = typeof updater === 'function' ? updater({ ...current }) : { ...current, ...(updater || {}) }
  return setPrefs(next)
}

export function getLastMode() {
  const prefs = readPrefs()
  return prefs.lastMode === 'pro' ? 'pro' : 'basic'
}

export function setLastMode(mode) {
  updatePrefs(p => ({ ...p, lastMode: mode === 'pro' ? 'pro' : 'basic' }))
}

export function getLastHintTimestamp() {
  const prefs = readPrefs()
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
  const prefs = readPrefs()
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

export function getGameplayPrefs() {
  const prefs = readPrefs()
  return {
    rankMode: prefs.rankMode,
    ranks: deriveRanks(prefs.rankMode),
    deckSource: prefs.deckSource,
    mixWeight: prefs.mixWeight,
    haptics: prefs.haptics,
    sfx: prefs.sfx,
    reducedMotion: prefs.reducedMotion,
    rankMigrationNotice: prefs.rankMigrationNotice,
  }
}

export function setGameplayPrefs(partial) {
  updatePrefs(p => {
    const nextRankMode = RANK_MODES[partial?.rankMode] ? partial.rankMode : p.rankMode
    return {
      ...p,
      rankMode: nextRankMode,
      ranks: deriveRanks(nextRankMode),
      deckSource: normalizeDeckSource(partial?.deckSource ?? p.deckSource),
      mixWeight: Number.isFinite(partial?.mixWeight) ? Math.min(100, Math.max(0, Math.round(partial.mixWeight))) : p.mixWeight,
      haptics: typeof partial?.haptics === 'boolean' ? partial.haptics : p.haptics,
      sfx: typeof partial?.sfx === 'boolean' ? partial.sfx : p.sfx,
      reducedMotion: typeof partial?.reducedMotion === 'boolean' ? partial.reducedMotion : p.reducedMotion,
      rankMigrationNotice: typeof partial?.rankMigrationNotice === 'boolean' ? partial.rankMigrationNotice : p.rankMigrationNotice,
    }
  })
}

export function consumeRankMigrationNotice() {
  updatePrefs(p => ({ ...p, rankMigrationNotice: false }))
}
