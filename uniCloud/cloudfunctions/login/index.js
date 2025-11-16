'use strict'
const auth = require('../common/auth.js')
const db = uniCloud.database()
const userCollection = db.collection('user')

const WX_APPID = process.env.WX_APPID || ''
const WX_SECRET = process.env.WX_SECRET || ''

function now() {
  return Date.now()
}

function ensureArray(value) {
  return Array.isArray(value) ? value.slice() : []
}

function ensurePlatforms(current = [], platform) {
  const list = ensureArray(current)
  if (platform && !list.includes(platform)) {
    list.push(platform)
  }
  return list
}

function normalizeStats(stats = {}) {
  return {
    score: Number.isFinite(Number(stats.score)) ? Number(stats.score) : 0,
    coins: Number.isFinite(Number(stats.coins)) ? Number(stats.coins) : 0
  }
}

function mergeStats(targetStats = {}, incomingStats = {}) {
  const base = normalizeStats(targetStats)
  const incoming = normalizeStats(incomingStats)
  return {
    score: Math.max(base.score, incoming.score),
    coins: base.coins + incoming.coins
  }
}

async function fetchWeixinSession(code) {
  if (!code) {
    throw new Error('缺少微信登录 code')
  }
  if (!WX_APPID || !WX_SECRET) {
    throw new Error('未配置微信小程序密钥')
  }
  const resp = await uniCloud.httpclient.request('https://api.weixin.qq.com/sns/jscode2session', {
    method: 'GET',
    dataType: 'json',
    data: {
      appid: WX_APPID,
      secret: WX_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    }
  })
  if (!resp.data || resp.data.errcode) {
    throw new Error(resp.data?.errmsg || '微信登录失败')
  }
  return resp.data
}

function sanitizeUser(user) {
  if (!user) return null
  const cloned = { ...user }
  delete cloned.password
  delete cloned.device_id
  delete cloned.merged_to
  delete cloned.unionid // 可根据需要返回，此处默认隐藏
  return cloned
}

async function handleMpWeixin(scenePayload = {}) {
  const { code, platform = 'mp-weixin' } = scenePayload
  const session = await fetchWeixinSession(code)
  const openid = session.openid
  const unionid = session.unionid || ''
  const nowTs = now()
  let userDoc = await userCollection.where({ openid }).limit(1).get()
  let user = userDoc.data[0]
  if (!user) {
    const newUser = {
      account_type: 'weixin',
      openid,
      unionid,
      device_id: '',
      nickname: '',
      avatar_url: '',
      platforms: ensurePlatforms([], platform),
      created_at: nowTs,
      last_login_at: nowTs,
      stats: normalizeStats(),
      gender: 0
    }
    const res = await userCollection.add(newUser)
    user = { _id: res.id, ...newUser }
  } else {
    const platforms = ensurePlatforms(user.platforms, platform)
    user.platforms = platforms
    user.last_login_at = nowTs
    await userCollection.doc(user._id).update({
      platforms,
      last_login_at: nowTs,
      unionid
    })
  }
  const token = auth.createToken(user)
  return { token, user: sanitizeUser(user) }
}

async function handleApp(scenePayload = {}) {
  const {
    deviceId,
    user_id,
    platform = 'app-plus',
    extra = {}
  } = scenePayload
  if (!deviceId) {
    throw new Error('缺少 deviceId，无法校验普通账号')
  }
  const nowTs = now()
  if (user_id) {
    const userDoc = await userCollection.doc(user_id).get()
    const user = userDoc.data && userDoc.data[0]
    if (!user) {
      throw new Error('普通账号不存在或已被删除')
    }
    if (user.account_type !== 'local') {
      throw new Error('该账号不是普通账号，无法通过本机登录')
    }
    if (user.device_id && user.device_id !== deviceId) {
      throw new Error('此账号仅限创建它的设备使用')
    }
    const platforms = ensurePlatforms(user.platforms, platform)
    user.platforms = platforms
    user.last_login_at = nowTs
    await userCollection.doc(user._id).update({
      last_login_at: nowTs,
      platforms
    })
    const token = auth.createToken(user)
    return { token, user: sanitizeUser(user) }
  }
  if (!extra || !extra.create) {
    throw new Error('缺少 user_id，且未指定创建普通账号')
  }
  const nickname = String(extra.nickname || '普通账号').slice(0, 32)
  const newUser = {
    account_type: 'local',
    openid: '',
    unionid: '',
    device_id: deviceId,
    nickname,
    avatar_url: extra.avatar_url || '',
    platforms: ensurePlatforms([], platform),
    created_at: nowTs,
    last_login_at: nowTs,
    stats: normalizeStats(extra.stats),
    gender: extra.gender || 0
  }
  const res = await userCollection.add(newUser)
  const user = { _id: res.id, ...newUser }
  const token = auth.createToken(user)
  return { token, user: sanitizeUser(user) }
}

async function handleUpgrade(scenePayload = {}) {
  const { code, user_id, platform = 'mp-weixin', deviceId } = scenePayload
  if (!code) {
    throw new Error('缺少微信登录 code')
  }
  if (!user_id) {
    throw new Error('缺少需要升级的 user_id')
  }
  const session = await fetchWeixinSession(code)
  const openid = session.openid
  const unionid = session.unionid || ''
  const localDoc = await userCollection.doc(user_id).get()
  const localUser = localDoc.data && localDoc.data[0]
  if (!localUser) {
    throw new Error('待升级的普通账号不存在')
  }
  if (localUser.account_type !== 'local') {
    throw new Error('该账号已是微信账号或不可升级')
  }
  if (deviceId && localUser.device_id && localUser.device_id !== deviceId) {
    throw new Error('此账号仅限创建它的设备升级')
  }
  const nowTs = now()
  const wxDoc = await userCollection.where({ openid }).limit(1).get()
  let user
  if (!wxDoc.data.length) {
    const platforms = ensurePlatforms(localUser.platforms, platform)
    const updated = {
      account_type: 'weixin',
      openid,
      unionid,
      last_login_at: nowTs,
      platforms
    }
    await userCollection.doc(localUser._id).update(updated)
    user = { ...localUser, ...updated }
  } else {
    const wxUser = wxDoc.data[0]
    const platforms = ensurePlatforms(wxUser.platforms, platform)
    const mergedStats = mergeStats(wxUser.stats, localUser.stats)
    await userCollection.doc(wxUser._id).update({
      stats: mergedStats,
      last_login_at: nowTs,
      platforms
    })
    await userCollection.doc(localUser._id).update({
      merged_to: wxUser._id,
      merged_at: nowTs
    })
    user = { ...wxUser, stats: mergedStats, platforms, last_login_at: nowTs }
  }
  const token = auth.createToken(user)
  return { token, user: sanitizeUser(user) }
}

module.exports = async (event = {}, context) => {
  const { scene, platform, code, deviceId, user_id, extra } = event
  if (scene === 'mp-weixin') {
    return await handleMpWeixin({ code, platform })
  }
  if (scene === 'app') {
    return await handleApp({ deviceId, user_id, platform, extra })
  }
  if (scene === 'upgrade') {
    return await handleUpgrade({ code, user_id, platform, deviceId })
  }
  throw new Error('不支持的登录场景')
}
