const ACCOUNT_KEY = 'tf24_local_accounts_v1'
const DEVICE_KEY = 'tf24_device_id_v1'
const CURRENT_KEY = 'tf24_current_account_id'

export function getLocalAccounts() {
  try {
    const stored = uni.getStorageSync(ACCOUNT_KEY)
    if (Array.isArray(stored)) return stored
  } catch (err) {
    console.warn('读取本地账号失败', err)
  }
  return []
}

export function saveLocalAccounts(list) {
  try {
    uni.setStorageSync(ACCOUNT_KEY, list || [])
  } catch (err) {
    console.warn('保存本地账号失败', err)
  }
}

export function upsertLocalAccount(account) {
  if (!account || !account.user_id) return
  const list = getLocalAccounts()
  const idx = list.findIndex(item => item.user_id === account.user_id)
  const payload = normalizeAccount(account)
  if (idx > -1) {
    list[idx] = { ...list[idx], ...payload }
  } else {
    list.push(payload)
  }
  saveLocalAccounts(list)
  return list
}

export function removeLocalAccount(userId) {
  const list = getLocalAccounts().filter(item => item.user_id !== userId)
  saveLocalAccounts(list)
  return list
}

export function findLocalAccount(userId) {
  return getLocalAccounts().find(item => item.user_id === userId)
}

export function setCurrentAccountId(userId) {
  try {
    uni.setStorageSync(CURRENT_KEY, userId || '')
  } catch (_) {}
}

export function getCurrentAccountId() {
  try {
    return uni.getStorageSync(CURRENT_KEY) || ''
  } catch (_) {
    return ''
  }
}

export function ensureDeviceId() {
  let id = ''
  try {
    id = uni.getStorageSync(DEVICE_KEY)
  } catch (_) {}
  if (id) return id
  // #ifdef APP-PLUS
  try {
    id = plus.device.uuid
  } catch (err) {
    console.warn('获取 plus.device.uuid 失败', err)
  }
  // #endif
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }
  try { uni.setStorageSync(DEVICE_KEY, id) } catch (_) {}
  return id
}

export function syncAccountFromRemote(user) {
  if (!user || !user._id) return
  upsertLocalAccount({
    user_id: user._id,
    nickname: user.nickname || '本机玩家',
    avatar_url: user.avatar_url || '',
    created_at: user.created_at || Date.now(),
    last_login_at: user.last_login_at || Date.now(),
  })
}

function normalizeAccount(account) {
  return {
    user_id: account.user_id || account._id,
    nickname: account.nickname || '本机玩家',
    avatar_url: account.avatar_url || '',
    created_at: account.created_at || Date.now(),
    last_login_at: account.last_login_at || Date.now(),
  }
}
