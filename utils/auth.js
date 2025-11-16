import { ensureDeviceId, upsertLocalAccount, setCurrentAccountId, getCurrentAccountId, syncAccountFromRemote } from './local-account.js'

const SESSION_KEY = 'tf24_session_v1'

export function getSession() {
  try {
    return uni.getStorageSync(SESSION_KEY) || null
  } catch (_) {
    return null
  }
}

export function setSession(payload) {
  try {
    uni.setStorageSync(SESSION_KEY, payload || null)
  } catch (err) {
    console.warn('写入 session 失败', err)
  }
}

export function clearSession() {
  try {
    uni.removeStorageSync(SESSION_KEY)
  } catch (_) {}
}

export async function loginWithWeixin(platform = 'mp-weixin') {
  // #ifndef MP-WEIXIN
  throw new Error('当前平台不支持微信登录')
  // #endif
  // #ifdef MP-WEIXIN
  const { code } = await uni.login({ provider: 'weixin' }).catch(err => {
    throw new Error(err?.errMsg || 'wx.login 失败')
  })
  const res = await callLogin({ scene: 'mp-weixin', code, platform })
  applySessionResponse(res)
  return res
  // #endif
}

export async function loginLocalAccount({ userId, platform = 'app-android' } = {}) {
  const deviceId = ensureDeviceId()
  if (!userId) {
    userId = getCurrentAccountId()
  }
  if (!userId) {
    throw new Error('缺少 user_id')
  }
  const res = await callLogin({ scene: 'app', deviceId, user_id: userId, platform })
  applySessionResponse(res)
  setCurrentAccountId(userId)
  syncAccountFromRemote(res.user)
  return res
}

export async function createLocalAccount({ nickname, avatar_url = '', platform = 'app-android' } = {}) {
  const deviceId = ensureDeviceId()
  const res = await callLogin({
    scene: 'app',
    deviceId,
    platform,
    create: true,
    extra: { nickname, avatar_url },
  })
  applySessionResponse(res)
  upsertLocalAccount({
    user_id: res.user._id,
    nickname: res.user.nickname || nickname,
    avatar_url: res.user.avatar_url || avatar_url,
    created_at: res.user.created_at,
    last_login_at: res.user.last_login_at,
  })
  setCurrentAccountId(res.user._id)
  return res
}

export async function upgradeLocalAccount({ userId, platform = 'mp-weixin' }) {
  if (!userId) {
    throw new Error('缺少 user_id')
  }
  // #ifndef MP-WEIXIN
  throw new Error('仅在微信小程序内支持升级')
  // #endif
  // #ifdef MP-WEIXIN
  const { code } = await uni.login({ provider: 'weixin' }).catch(err => {
    throw new Error(err?.errMsg || 'wx.login 失败')
  })
  const res = await callLogin({ scene: 'upgrade', code, user_id: userId, platform })
  applySessionResponse(res)
  syncAccountFromRemote(res.user)
  return res
  // #endif
}

async function callLogin(data) {
  const resp = await uniCloud.callFunction({ name: 'login', data })
  if (!resp || !resp.result) {
    throw new Error('云函数无返回')
  }
  if (!resp.result.success) {
    throw new Error(resp.result.errMsg || '登录失败')
  }
  if (!resp.result.token || !resp.result.user) {
    throw new Error('云端返回数据不完整')
  }
  return resp.result
}

function applySessionResponse(res) {
  const session = {
    token: res.token,
    user: res.user,
    timestamp: Date.now(),
  }
  setSession(session)
}
