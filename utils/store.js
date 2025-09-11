// Simple local storage wrapper for users and stats
// Data shape:
//  - users: { list: [{ id, name, avatar, color, createdAt, lastPlayedAt }], currentId }
//  - stats: { [userId]: { totals: { total, success, fail }, days: { 'YYYY-MM-DD': { total, success, fail } } } }

const UKEY = 'tf24_users_v1'
const SKEY = 'tf24_stats_v1' // 保持键名不变，内部加版本与扩展字段
const STATS_VERSION = 2
const MAX_ROUNDS = 1000 // 明细条数上限，超出丢弃最旧

function load(key, defVal) {
  try {
    const val = uni.getStorageSync(key)
    if (!val) return defVal
    return typeof val === 'string' ? JSON.parse(val) : val
  } catch (e) { return defVal }
}
function save(key, val) { try { uni.setStorageSync(key, JSON.stringify(val)) } catch (e) {} }

export function ensureInit() {
  const users = load(UKEY, null)
  if (!users || typeof users !== 'object' || !Array.isArray(users.list)) {
    save(UKEY, { list: [], currentId: '' })
  } else {
    // migrate old records: ensure fields exist
    const migrated = { ...users }
    migrated.list = (users.list || []).map(u => ({
      id: u.id || genId(),
      name: u.name || '玩家',
      avatar: u.avatar || '',
      color: u.color || randomColor(),
      createdAt: u.createdAt || Date.now(),
      lastPlayedAt: u.lastPlayedAt || 0
    }))
    // 移除历史产生的游客账号（名称为 'Guest'），不保留记录
    const guestIds = new Set(migrated.list.filter(u => String(u.name||'') === 'Guest').map(u => u.id))
    if (guestIds.size > 0) {
      migrated.list = migrated.list.filter(u => !guestIds.has(u.id))
      if (guestIds.has(migrated.currentId)) {
        migrated.currentId = (migrated.list[0] && migrated.list[0].id) || ''
      }
    }
    if (migrated !== users) save(UKEY, migrated)
  }
  // 统计初始化与迁移
  const stats = load(SKEY, null)
  if (!stats || typeof stats !== 'object') {
    save(SKEY, { _version: STATS_VERSION })
  } else {
    // 若缺少版本或版本落后，进行惰性迁移（保持原有 totals/days 接口兼容）
    if (!stats._version || stats._version < STATS_VERSION) {
      const migrated = { ...stats }
      for (const k of Object.keys(migrated)) {
        if (k.startsWith && k.startsWith('_')) continue
        const rec = migrated[k]
        if (!rec || typeof rec !== 'object') { migrated[k] = { totals:{ total:0, success:0, fail:0 }, days:{}, rounds:[], agg:{} }; continue }
        const totals = rec.totals && typeof rec.totals === 'object' ? rec.totals : { total:0, success:0, fail:0 }
        const days = rec.days && typeof rec.days === 'object' ? rec.days : {}
        const rounds = Array.isArray(rec.rounds) ? rec.rounds : []
        const agg = rec.agg && typeof rec.agg === 'object' ? rec.agg : {}
        migrated[k] = { totals, days, rounds, agg }
      }
      migrated._version = STATS_VERSION
      save(SKEY, migrated)
    }
  }
}

export function getUsers() { return load(UKEY, { list: [], currentId: '' }) }
export function setUsers(data) { save(UKEY, data) }
export function getCurrentUser() { const u = getUsers(); return u.list.find(x=>x.id===u.currentId) }
export function switchUser(id) { const u = getUsers(); if (u.list.find(x=>x.id===id)) { u.currentId=id; setUsers(u) } }
export function addUser(name, avatar = '', color) {
  const u = getUsers();
  const id = genId();
  const rec = {
    id,
    name: name || `玩家${(u.list?.length || 0) + 1}`,
    avatar: avatar || '',
    color: color || randomColor(),
    createdAt: Date.now(),
    lastPlayedAt: 0
  }
  u.list = (u.list || []).concat([rec])
  if (!u.currentId) u.currentId = id
  setUsers(u)
  return id
}
export function renameUser(id, name) { const u = getUsers(); const t=u.list.find(x=>x.id===id); if (t){ t.name=name; setUsers(u) } }
export function removeUser(id) { const u=getUsers(); u.list=u.list.filter(x=>x.id!==id); if (u.currentId===id) u.currentId=(u.list[0]&&u.list[0].id)||''; setUsers(u) }
export function setUserAvatar(id, avatar) { const u = getUsers(); const t = (u.list||[]).find(x=>x.id===id); if (t){ t.avatar = avatar || ''; setUsers(u) } }
export function setUserColor(id, color) { const u = getUsers(); const t = (u.list||[]).find(x=>x.id===id); if (t){ t.color = color || randomColor(); setUsers(u) } }

// 记录一局：兼容旧签名 pushRound(boolean)
// 新签名：pushRound({ success, timeMs?, hintUsed?, retries?, ops?, exprLen?, maxDepth?, faceUseHigh?, hand?, solutionsCount?, expr? })
export function pushRound(arg) {
  const users = getUsers(); const uid = users.currentId; if (!uid) return
  const stats = load(SKEY, { _version: STATS_VERSION })
  if (!stats._version) stats._version = STATS_VERSION
  if (!stats[uid]) stats[uid] = { totals: { total:0, success:0, fail:0 }, days: {}, rounds: [], agg: {} }
  const rec = stats[uid]
  const today = new Date(); const key = today.toISOString().slice(0,10)
  if (!rec.days[key]) rec.days[key] = { total:0, success:0, fail:0 }

  const isBool = (typeof arg === 'boolean')
  const success = isBool ? !!arg : !!arg?.success
  const now = Date.now()
  const round = isBool ? null : {
    id: genId(),
    ts: now,
    success: !!arg?.success,
    timeMs: Number.isFinite(arg?.timeMs) ? Math.max(0, Math.floor(arg.timeMs)) : undefined,
    hintUsed: !!arg?.hintUsed,
    retries: Number.isFinite(arg?.retries) ? Math.max(0, Math.floor(arg.retries)) : undefined,
    ops: Array.isArray(arg?.ops) ? arg.ops.slice(0, 16) : undefined,
    exprLen: Number.isFinite(arg?.exprLen) ? Math.max(0, Math.floor(arg.exprLen)) : undefined,
    maxDepth: Number.isFinite(arg?.maxDepth) ? Math.max(0, Math.floor(arg.maxDepth)) : undefined,
    faceUseHigh: typeof arg?.faceUseHigh === 'boolean' ? arg.faceUseHigh : undefined,
    hand: arg?.hand && Array.isArray(arg.hand.cards) ? { cards: arg.hand.cards.map(c => ({ rank: +c.rank, suit: c.suit })) } : undefined,
    solutionsCount: Number.isFinite(arg?.solutionsCount) ? Math.max(0, Math.floor(arg.solutionsCount)) : undefined,
    expr: typeof arg?.expr === 'string' ? arg.expr : undefined,
  }

  // 聚合计数（保持与 v1 兼容）
  rec.totals.total += 1
  rec.days[key].total += 1
  if (success) { rec.totals.success += 1; rec.days[key].success += 1 }
  else { rec.totals.fail += 1; rec.days[key].fail += 1 }

  // 明细与派生聚合
  if (round) {
    rec.rounds.push(round)
    if (rec.rounds.length > MAX_ROUNDS) rec.rounds.splice(0, rec.rounds.length - MAX_ROUNDS)
    // 最佳耗时（仅成功局参与）
    if (round.success && Number.isFinite(round.timeMs)) {
      const best = rec.agg?.bestTimeMs
      rec.agg.bestTimeMs = (Number.isFinite(best) ? Math.min(best, round.timeMs) : round.timeMs)
    }
    // 连胜：如果 success 则 +1，否则清零
    const cur = rec.agg?.currentStreak || 0
    rec.agg.currentStreak = success ? (cur + 1) : 0
    const longest = rec.agg?.longestStreak || 0
    if (rec.agg.currentStreak > longest) rec.agg.longestStreak = rec.agg.currentStreak
  }

  save(SKEY, stats)
  // 更新用户最近游玩时间
  try {
    const u = getUsers();
    const t = (u.list || []).find(x => x.id === uid)
    if (t) { t.lastPlayedAt = Date.now(); setUsers(u) }
  } catch (_) { /* noop */ }
}

export function readStats(uid) { const s = load(SKEY, {}); return s[uid] || { totals: { total:0, success:0, fail:0 }, days:{} } }

// 读取包含 rounds/agg 的扩展统计（若不存在则回退最小结构）
export function readStatsExtended(uid) {
  const s = load(SKEY, { _version: STATS_VERSION })
  const rec = s[uid] || { totals: { total:0, success:0, fail:0 }, days:{}, rounds:[], agg:{} }
  if (!rec.rounds) rec.rounds = []
  if (!rec.agg) rec.agg = {}
  return rec
}

// Update only the last played timestamp for a user (no stats change)
export function touchLastPlayed(id) {
  try {
    const u = getUsers();
    const uid = id || u.currentId;
    if (!uid) return;
    const t = (u.list || []).find(x => x.id === uid)
    if (t) { t.lastPlayedAt = Date.now(); setUsers(u) }
  } catch (_) { /* noop */ }
}

function genId(){ return Math.random().toString(36).slice(2,10) }
function randomColor(){
  const palette = ['#e2e8f0','#fde68a','#bbf7d0','#bfdbfe','#fecaca','#f5d0fe','#c7d2fe']
  return palette[Math.floor(Math.random()*palette.length)]
}

// Helpers for ranking/overview
export function listUsers() { return getUsers().list || [] }
export function allUsersWithStats() {
  const users = getUsers().list || []
  const s = load(SKEY, {})
  return users.map(u => {
    const st = s[u.id] || { totals:{ total:0, success:0, fail:0 }, days:{} }
    const t = st.totals || { total:0, success:0, fail:0 }
    const winRate = t.total ? Math.round(100 * (t.success / t.total)) : 0
    const bestTimeMs = (st.agg && st.agg.bestTimeMs) || undefined
    const currentStreak = (st.agg && st.agg.currentStreak) || 0
    const longestStreak = (st.agg && st.agg.longestStreak) || 0
    return { id: u.id, name: u.name, totals: t, winRate, bestTimeMs, currentStreak, longestStreak }
  })
}

export function resetAllData() {
  try { uni.clearStorageSync() } catch (_) {}
  ensureInit()
}
