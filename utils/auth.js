const TOKEN_KEY = 'tf24_cloud_token'
const USER_KEY = 'tf24_cloud_user'

function setStorage(key, value) {
  try {
    uni.setStorageSync(key, value)
  } catch (err) {
    console.warn('storage failed', err)
  }
}

function getStorage(key) {
  try {
    return uni.getStorageSync(key)
  } catch (err) {
    return null
  }
}

export function getSession() {
  return {
    token: getStorage(TOKEN_KEY) || '',
    user: getStorage(USER_KEY) || null
  }
}

export function saveSession({ token, user }) {
  if (token) setStorage(TOKEN_KEY, token)
  if (user) setStorage(USER_KEY, user)
  return { token, user }
}

export function clearSession() {
  try { uni.removeStorageSync(TOKEN_KEY) } catch (err) {}
  try { uni.removeStorageSync(USER_KEY) } catch (err) {}
}

function resolvePlatform() {
  // #ifdef MP-WEIXIN
  return 'mp-weixin'
  // #endif
  // #ifdef APP-ANDROID
  return 'app-android'
  // #endif
  // #ifdef APP-IOS
  return 'app-ios'
  // #endif
  // #ifdef APP-HARMONY
  return 'app-harmony'
  // #endif
  // #ifdef APP-PLUS
  return 'app-plus'
  // #endif
  return 'unknown'
}

export async function wxLogin() {
  // #ifndef MP-WEIXIN
  throw new Error('仅支持在微信小程序中调用 wxLogin')
  // #endif
  const loginResult = await uni.login({ provider: 'weixin' })
  let loginErr = null
  let loginRes = loginResult
  if (Array.isArray(loginResult)) {
    loginErr = loginResult[0]
    loginRes = loginResult[1]
  }
  if (loginErr) {
    throw loginErr
  }
  if (!loginRes?.code) {
    throw new Error('微信登录失败')
  }
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'mp-weixin', code: loginRes.code, platform: resolvePlatform() }
  })
  if (!result) throw new Error('云函数返回为空')
  return saveSession(result)
}

export async function appLogin() {
  // #ifndef APP-PLUS
  throw new Error('仅支持在 App 中调用 appLogin')
  // #endif
  const safePlus = typeof plus !== 'undefined' ? plus : null
  const deviceId = safePlus?.device?.uuid || safePlus?.device?.imei || ''
  if (!deviceId) {
    throw new Error('无法获取设备ID')
  }
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'app', deviceId, platform: resolvePlatform() }
  })
  if (!result) throw new Error('云函数返回为空')
  return saveSession(result)
}

export async function getWxProfileAndUpdate() {
  // #ifndef MP-WEIXIN
  return null
  // #endif
  const profile = await uni.getUserProfile({ desc: '用于完善资料' })
  const { token } = getSession()
  if (!token) return null
  const { result } = await uniCloud.callFunction({
    name: 'user',
    data: {
      action: 'updateProfile',
      token,
      data: {
        nickname: profile.userInfo.nickName,
        avatar_url: profile.userInfo.avatarUrl,
        gender: profile.userInfo.gender
      }
    }
  })
  if (result?.user) {
    saveSession({ token, user: result.user })
  }
  return result?.user
}

async function silentLogin() {
  const existing = getSession()
  if (existing.token) return existing
  // #ifdef MP-WEIXIN
  return await wxLogin()
  // #endif
  // #ifdef APP-PLUS
  return await appLogin()
  // #endif
  return existing
}

export async function ensureAutoLogin() {
  try {
    return await silentLogin()
  } catch (err) {
    console.warn('auto login failed', err)
    return null
  }
}
