'use strict'

const crypto = require('crypto')
const auth = require('../common/auth/index.js')
const db = uniCloud.database()
const users = db.collection('user')

const ENV_WX_APPID = process.env.WX_APPID || ''
const ENV_WX_SECRET = process.env.WX_SECRET || ''
let configCenter
try {
  if (typeof uniCloud.getConfigCenter === 'function') {
    configCenter = uniCloud.getConfigCenter()
  }
} catch (err) {
  console.warn('读取 uni-config-center 失败，可忽略（将使用环境变量）', err && err.message)
}
let cachedWxConfig = null

exports.main = async (event, context) => {
  const scene = event && event.scene
  try {
    let result
    if (scene === 'mp-weixin') {
      result = await handleMpWeixin(event)
    } else if (scene === 'app') {
      result = await handleApp(event)
    } else if (scene === 'upgrade') {
      result = await handleUpgrade(event)
    } else {
      throw new Error('scene 不受支持')
    }
    return { success: true, ...result }
  } catch (err) {
    return {
      success: false,
      errCode: err.errCode || -1,
      errMsg: err.message || '登录失败',
    }
  }
}

async function handleMpWeixin(event = {}) {
  const { code, platform } = event
  if (!code) {
    throw new Error('code 缺失')
  }
  const session = await fetchWeixinSession(code)
  if (!session || !session.openid) {
    throw new Error('获取 openid 失败')
  }
  const openid = session.openid
  const unionid = session.unionid || ''

  const userRes = await users.where({ openid }).limit(1).get()
  let userDoc = userRes.data && userRes.data[0]
  const now = Date.now()
  if (!userDoc) {
    const newUser = {
      _id: generateUserId(),
      account_type: 'weixin',
      openid,
      unionid,
      device_id: '',
      nickname: '',
      avatar_url: '',
      platforms: appendPlatform([], platform || 'mp-weixin'),
      created_at: now,
      last_login_at: now,
      stats: defaultStats(),
    }
    await users.add(newUser)
    userDoc = newUser
  } else {
    await users.doc(userDoc._id).update({
      last_login_at: now,
      unionid: unionid || userDoc.unionid || '',
      platforms: appendPlatform(userDoc.platforms, platform || 'mp-weixin'),
    })
    userDoc = { ...userDoc, last_login_at: now, unionid: unionid || userDoc.unionid || '', platforms: appendPlatform(userDoc.platforms, platform || 'mp-weixin') }
  }

  const token = auth.createToken(userDoc)
  return { token, user: sanitizeUser(userDoc) }
}

async function handleApp(event = {}) {
  const { deviceId, user_id, platform, extra = {}, create } = event
  if (!deviceId) {
    throw new Error('deviceId 缺失')
  }
  const now = Date.now()
  if (user_id) {
    const snap = await users.doc(user_id).get()
    const userDoc = snap.data && snap.data[0]
    if (!userDoc) {
      throw new Error('账号不存在')
    }
    if (userDoc.account_type !== 'local') {
      throw new Error('仅普通账号可使用此入口登录')
    }
    if (!userDoc.device_id || userDoc.device_id !== deviceId) {
      throw new Error('此账号仅限创建它的设备使用')
    }
    await users.doc(userDoc._id).update({
      last_login_at: now,
      platforms: appendPlatform(userDoc.platforms, platform || 'app-unknown'),
    })
    const merged = { ...userDoc, last_login_at: now, platforms: appendPlatform(userDoc.platforms, platform || 'app-unknown') }
    const token = auth.createToken(merged)
    return { token, user: sanitizeUser(merged) }
  }

  if (!create) {
    throw new Error('缺少 user_id，且未声明创建账号')
  }
  const nickname = (extra.nickname && String(extra.nickname).trim()) || '本机玩家'
  const avatar_url = extra.avatar_url || ''
  const newUser = {
    _id: generateUserId(),
    account_type: 'local',
    openid: '',
    unionid: '',
    device_id: deviceId,
    nickname,
    avatar_url,
    platforms: appendPlatform([], platform || 'app-unknown'),
    created_at: now,
    last_login_at: now,
    stats: defaultStats(),
  }
  await users.add(newUser)
  const token = auth.createToken(newUser)
  return { token, user: sanitizeUser(newUser) }
}

async function handleUpgrade(event = {}) {
  const { code, user_id, platform } = event
  if (!code || !user_id) {
    throw new Error('参数缺失')
  }
  const session = await fetchWeixinSession(code)
  if (!session || !session.openid) {
    throw new Error('获取微信身份失败')
  }
  const openid = session.openid
  const unionid = session.unionid || ''
  const now = Date.now()

  const localSnap = await users.doc(user_id).get()
  const localUser = localSnap.data && localSnap.data[0]
  if (!localUser) {
    throw new Error('待升级账号不存在')
  }
  if (localUser.account_type !== 'local') {
    throw new Error('仅普通账号支持升级')
  }

  const wxSnap = await users.where({ openid }).limit(1).get()
  const wxUser = wxSnap.data && wxSnap.data[0]
  if (!wxUser) {
    await users.doc(localUser._id).update({
      account_type: 'weixin',
      openid,
      unionid,
      platforms: appendPlatform(localUser.platforms, platform || 'mp-weixin'),
      last_login_at: now,
    })
    const upgraded = {
      ...localUser,
      account_type: 'weixin',
      openid,
      unionid,
      platforms: appendPlatform(localUser.platforms, platform || 'mp-weixin'),
      last_login_at: now,
    }
    const token = auth.createToken(upgraded)
    return { token, user: sanitizeUser(upgraded) }
  }

  const mergedStats = mergeStats(wxUser.stats, localUser.stats)
  await users.doc(wxUser._id).update({
    stats: mergedStats,
    last_login_at: now,
    platforms: appendPlatform(wxUser.platforms, platform || 'mp-weixin'),
  })
  await users.doc(localUser._id).update({ merged_to: wxUser._id, merged_at: now })
  const mergedUser = {
    ...wxUser,
    stats: mergedStats,
    last_login_at: now,
    platforms: appendPlatform(wxUser.platforms, platform || 'mp-weixin'),
  }
  const token = auth.createToken(mergedUser)
  return { token, user: sanitizeUser(mergedUser) }
}

async function fetchWeixinSession(code) {
  const { appid, secret } = resolveWeixinConfig()
  const url = 'https://api.weixin.qq.com/sns/jscode2session'
  const res = await uniCloud.httpclient.request(url, {
    method: 'GET',
    data: {
      appid,
      secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
    dataType: 'json',
    timeout: 5000,
  })
  const data = res.data || {}
  if (data.errcode) {
    const err = new Error(data.errmsg || 'jscode2session 失败')
    err.errCode = data.errcode
    throw err
  }
  return data
}

function resolveWeixinConfig() {
  if (cachedWxConfig) {
    return cachedWxConfig
  }
  const envCred = pickWxCredential({ appid: ENV_WX_APPID, secret: ENV_WX_SECRET })
  if (envCred && !envCred.appid.includes('YOUR_WECHAT')) {
    cachedWxConfig = envCred
    return cachedWxConfig
  }
  const candidates = []
  if (configCenter && typeof configCenter.config === 'function') {
    candidates.push(configCenter.config('wx-login'))
    candidates.push(configCenter.config('weixin'))
    candidates.push(configCenter.config('uni-id'))
  }
  if (configCenter && typeof configCenter.require === 'function') {
    try { candidates.push(configCenter.require('wx-login')) } catch (_) {}
    try { candidates.push(configCenter.require('weixin')) } catch (_) {}
    try { candidates.push(configCenter.require('uni-id')) } catch (_) {}
  }
  for (const candidate of candidates) {
    const cred = extractWxConfig(candidate)
    if (cred) {
      cachedWxConfig = cred
      return cachedWxConfig
    }
  }
  throw new Error('请在环境变量或 uni-config-center 中配置 WX_APPID/WX_SECRET')
}

function extractWxConfig(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }
  if (candidate['mp-weixin']) {
    const cred = pickWxCredential(candidate['mp-weixin'])
    if (cred) return cred
  }
  if (candidate.mp && candidate.mp.weixin) {
    const cred = pickWxCredential(candidate.mp.weixin)
    if (cred) return cred
  }
  if (candidate.weixin) {
    const cred = pickWxCredential(candidate.weixin)
    if (cred) return cred
  }
  return pickWxCredential(candidate)
}

function pickWxCredential(obj) {
  if (!obj || typeof obj !== 'object') return null
  const appid = obj.appid || obj.appId || ''
  const secret = obj.secret || obj.appsecret || obj.appSecret || ''
  if (appid && secret) {
    return { appid, secret }
  }
  return null
}

function sanitizeUser(user) {
  if (!user) return null
  const clone = { ...user }
  delete clone.openid
  delete clone.device_id
  delete clone.unionid
  return clone
}

function appendPlatform(list = [], platform) {
  const arr = Array.isArray(list) ? list.slice() : []
  if (platform && !arr.includes(platform)) {
    arr.push(platform)
  }
  return arr
}

function defaultStats() {
  return { score: 0, coins: 0 }
}

function mergeStats(a = {}, b = {}) {
  return {
    score: Math.max(Number(a.score) || 0, Number(b.score) || 0),
    coins: (Number(a.coins) || 0) + (Number(b.coins) || 0),
  }
}

function generateUserId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
