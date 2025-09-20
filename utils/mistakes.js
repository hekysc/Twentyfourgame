const KEY_PREFIX = 'mistakes:'

function createEmptyBook() {
  return { active: {}, ledger: {} }
}

function toInt(val) {
  const num = Number(val)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.floor(num))
}

function sanitizeNums(nums, fallbackKey) {
  if (Array.isArray(nums) && nums.length) {
    return nums.map(n => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b)
  }
  if (typeof fallbackKey === 'string' && fallbackKey) {
    return fallbackKey.split(',').map(n => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b)
  }
  return []
}

function sanitizeItem(key, item) {
  const now = Date.now()
  const base = item && typeof item === 'object' ? item : {}
  const nums = sanitizeNums(base.nums, key)
  const attempts = toInt(base.attempts)
  const wrong = toInt(base.wrong)
  const correct = toInt(base.correct)
  const total = attempts || (wrong + correct)
  const streak = toInt(base.streakCorrect)
  const lastSeen = Number.isFinite(+base.lastSeenTs) ? +base.lastSeenTs : 0
  const created = Number.isFinite(+base.createdTs) ? +base.createdTs : now
  const lastResult = base.lastResult === 'correct' || base.lastResult === 'wrong' ? base.lastResult : null
  return {
    key: typeof base.key === 'string' && base.key ? base.key : key,
    nums,
    attempts: total,
    wrong,
    correct,
    lastSeenTs: lastSeen,
    lastResult,
    streakCorrect: streak,
    createdTs: created,
  }
}

export function normalizeKey(nums = []) {
  if (!Array.isArray(nums) || nums.length === 0) return ''
  return nums
    .map(n => Number.isFinite(+n) ? +n : 0)
    .sort((a, b) => a - b)
    .join(',')
}

export function loadMistakeBook(userId) {
  if (!userId) return createEmptyBook()
  try {
    const raw = uni.getStorageSync(KEY_PREFIX + userId)
    if (!raw) return createEmptyBook()
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || typeof data !== 'object') return createEmptyBook()
    const book = createEmptyBook()
    const active = data.active && typeof data.active === 'object' ? data.active : {}
    const ledger = data.ledger && typeof data.ledger === 'object' ? data.ledger : {}
    for (const key of Object.keys(active)) {
      book.active[key] = sanitizeItem(key, active[key])
    }
    for (const key of Object.keys(ledger)) {
      book.ledger[key] = sanitizeItem(key, ledger[key])
    }
    return book
  } catch (_) {
    return createEmptyBook()
  }
}

export function saveMistakeBook(userId, book) {
  if (!userId) return
  const data = book && typeof book === 'object' ? book : createEmptyBook()
  try {
    uni.setStorageSync(KEY_PREFIX + userId, JSON.stringify({
      active: data.active || {},
      ledger: data.ledger || {},
    }))
  } catch (_) {
    /* noop */
  }
}

export function getActivePool(userId) {
  const book = loadMistakeBook(userId)
  return Object.values(book.active || {})
}

export function recordRoundResult({ userId, nums, success }) {
  if (!userId || !Array.isArray(nums) || nums.length === 0) return
  const sortedNums = nums.map(n => Number.isFinite(+n) ? +n : 0).sort((a, b) => a - b)
  const key = normalizeKey(sortedNums)
  if (!key) return
  const now = Date.now()
  const book = loadMistakeBook(userId)
  const ledger = book.ledger || {}
  const active = book.active || {}

  const existingLedger = ledger[key] ? sanitizeItem(key, ledger[key]) : sanitizeItem(key, { key, nums: sortedNums, createdTs: now })
  const updated = { ...existingLedger }
  updated.nums = sortedNums.slice()
  updated.attempts = toInt(updated.attempts) + 1
  updated.createdTs = Number.isFinite(+updated.createdTs) ? +updated.createdTs : now
  updated.lastSeenTs = now
  updated.lastResult = success ? 'correct' : 'wrong'
  if (success) {
    updated.correct = toInt(updated.correct) + 1
    updated.streakCorrect = toInt(updated.streakCorrect) + 1
  } else {
    updated.wrong = toInt(updated.wrong) + 1
    updated.streakCorrect = 0
  }
  ledger[key] = updated

  const isActive = !!active[key]
  if (!success) {
    const activeItem = isActive ? sanitizeItem(key, active[key]) : sanitizeItem(key, { key, nums: sortedNums, createdTs: now })
    activeItem.nums = sortedNums.slice()
    activeItem.attempts = updated.attempts
    activeItem.wrong = updated.wrong
    activeItem.correct = updated.correct
    activeItem.lastSeenTs = now
    activeItem.lastResult = 'wrong'
    activeItem.streakCorrect = 0
    active[key] = activeItem
  } else if (success && updated.streakCorrect >= 5) {
    if (isActive) delete active[key]
  } else if (isActive) {
    const activeItem = sanitizeItem(key, active[key])
    activeItem.nums = sortedNums.slice()
    activeItem.attempts = updated.attempts
    activeItem.wrong = updated.wrong
    activeItem.correct = updated.correct
    activeItem.lastSeenTs = now
    activeItem.lastResult = 'correct'
    activeItem.streakCorrect = updated.streakCorrect
    active[key] = activeItem
  }

  book.ledger = ledger
  book.active = active
  saveMistakeBook(userId, book)
}

export function getSummary(userId) {
  const book = loadMistakeBook(userId)
  const ledger = book.ledger || {}
  let totalWrong = 0
  for (const key of Object.keys(ledger)) {
    totalWrong += toInt(ledger[key]?.wrong)
  }
  const totalActive = Object.keys(book.active || {}).length
  return { totalWrongCount: totalWrong, totalActiveCount: totalActive }
}

export function syncMistakeBook() {
  // 预留接口，未来可用于云端同步
}

export default {
  normalizeKey,
  loadMistakeBook,
  saveMistakeBook,
  getActivePool,
  recordRoundResult,
  getSummary,
  syncMistakeBook,
}
