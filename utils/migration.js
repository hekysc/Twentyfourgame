const MARK = 'tf24_practice_migrated_v1'
export function readJSON(key, fallback) {
  try {
    const v = uni.getStorageSync(key)
    return v ? (typeof v === 'string' ? JSON.parse(v) : v) : fallback
  } catch (_) {
    return fallback
  }
}
export function writeJSON(key, value) {
  uni.setStorageSync(key, JSON.stringify(value))
}
export function emptyStats() {
  return {
    totals: { total: 0, success: 0, fail: 0 },
    days: {},
    rounds: [],
    agg: {},
  }
}
export function migratePractice() {
  if (uni.getStorageSync(MARK)) return
  const old = readJSON('tf24_stats_v1', {}),
    users = readJSON('tf24_users_v1', { list: [] })
  // Keep untouched originals and a backup before marking migration complete.
  const books = {},
    merged = emptyStats(),
    book = { active: {}, ledger: {} }
  const ids = new Set([
    ...(users.list || []).map((u) => u.id),
    ...Object.keys(old).filter((k) => !k.startsWith('_')),
  ])
  for (const id of ids) {
    const st = old[id] || emptyStats()
    for (const k of ['total', 'success', 'fail'])
      merged.totals[k] += Number(st.totals?.[k]) || 0
    for (const [day, value] of Object.entries(st.days || {})) {
      const target = (merged.days[day] ||= { total: 0, success: 0, fail: 0 })
      for (const k of ['total', 'success', 'fail'])
        target[k] += Number(value[k]) || 0
    }
    merged.rounds.push(
      ...(st.rounds || []).map((r, i) => ({ ...r, id: `${id}:${r.id || i}` })),
    )
    if (Number.isFinite(st.agg?.bestTimeMs))
      merged.agg.bestTimeMs = Math.min(
        merged.agg.bestTimeMs ?? Infinity,
        st.agg.bestTimeMs,
      )
    const b = (books[id] = readJSON(`mistakes:${id}`, {
      active: {},
      ledger: {},
    }))
    for (const key of new Set([
      ...Object.keys(b.ledger || {}),
      ...Object.keys(b.active || {}),
    ])) {
      const item = b.ledger?.[key] || b.active[key],
        previous = book.ledger[key]
      const latest =
        !previous || item.lastSeenTs >= previous.lastSeenTs ? item : previous
      book.ledger[key] = {
        ...latest,
        key,
        attempts: (previous?.attempts || 0) + (item.attempts || 0),
        correct: (previous?.correct || 0) + (item.correct || 0),
        wrong: (previous?.wrong || 0) + (item.wrong || 0),
      }
      if (b.active?.[key]) book.active[key] = book.ledger[key]
    }
  }
  merged.rounds.sort((a, b) => a.ts - b.ts)
  for (const key of Object.keys(book.active))
    book.active[key] = { ...book.ledger[key], streakCorrect: 0 }
  writeJSON('tf24_legacy_backup_v1', { users, stats: old, books })
  writeJSON('tf24_stats:practice', merged)
  writeJSON('mistakes:practice', book)
  writeJSON(
    'tf24_prefs:practice',
    readJSON('tf24_prefs_v2', readJSON('tf24_prefs_v1', {})),
  )
  uni.removeStorageSync('tf24_game_session_v1')
  uni.setStorageSync(MARK, true)
}
