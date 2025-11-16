'use strict'

const db = uniCloud.database()
const usersCollection = db.collection('user')
const dbCmd = db.command
const { createToken } = require('../common/auth')

const DEFAULT_STATS = { score: 0, coins: 0 }

module.exports = async (event = {}, context) => {
  const { scene } = event
  if (!scene) {
    throw new Error('scene is required')
  }

  if (scene === 'mp-weixin') {
    return handleMpWeixin(event)
  }

  if (scene === 'app') {
    return handleApp(event)
  }

  if (scene === 'upgrade') {
    return handleUpgrade(event)
  }

  throw new Error(`unsupported scene: ${scene}`)
}

async function handleMpWeixin(event) {
  const { code, platform = 'mp-weixin' } = event
  if (!code) {
    throw new Error('code is required for mp-weixin login')
  }

  const session = await fetchWeixinSession(code)
  const { openid, unionid } = session
  if (!openid) {
    throw new Error('failed to obtain openid from wx jscode2session')
  }

  const now = Date.now()
  let user = await usersCollection.where({ openid }).get().then(transformFirst)

  if (!user) {
    const doc = {
      account_type: 'weixin',
      openid,
      unionid,
      device_id: '',
      nickname: '',
      avatar_url: '',
      platforms: [platform],
      stats: { ...DEFAULT_STATS },
      created_at: now,
      last_login_at: now
    }
    const addRes = await usersCollection.add(doc)
    user = { ...doc, _id: addRes.id }
  } else {
    const updatePayload = {
      last_login_at: now,
      unionid: unionid || user.unionid,
      ...platformUpdate(platform)
    }
    await usersCollection.doc(user._id).update(updatePayload)
    user = applyPlatform({ ...user, last_login_at: now, unionid: unionid || user.unionid }, platform)
  }

  const token = createToken({ user_id: user._id, account_type: 'weixin' })
  return { token, user: sanitizeUser(user) }
}

async function handleApp(event) {
  const { deviceId, user_id, platform = 'app-android', extra = {} } = event
  if (!deviceId) {
    throw new Error('deviceId is required for app login')
  }

  const now = Date.now()
  let user

  if (user_id) {
    user = await getUserById(user_id)
    if (!user) {
      throw new Error('user not found')
    }
    if (user.account_type !== 'local') {
      throw new Error('only local accounts can be used via app scene user_id login')
    }
    if (user.device_id !== deviceId) {
      throw new Error('此账号仅限本机使用')
    }

    await usersCollection.doc(user._id).update({
      last_login_at: now,
      ...platformUpdate(platform)
    })
    user = applyPlatform({ ...user, last_login_at: now }, platform)
  } else {
    const nickname = extra.nickname || generateDefaultNickname()
    const avatar_url = extra.avatar_url || ''
    const doc = {
      account_type: 'local',
      device_id: deviceId,
      nickname,
      avatar_url,
      platforms: [platform],
      stats: { ...DEFAULT_STATS },
      created_at: now,
      last_login_at: now
    }
    const addRes = await usersCollection.add(doc)
    user = { ...doc, _id: addRes.id }
  }

  const token = createToken({ user_id: user._id, account_type: user.account_type })
  return { token, user: sanitizeUser(user) }
}

async function handleUpgrade(event) {
  const { code, user_id, platform = 'mp-weixin' } = event
  if (!code) {
    throw new Error('code is required for upgrade')
  }
  if (!user_id) {
    throw new Error('user_id is required for upgrade')
  }

  const session = await fetchWeixinSession(code)
  const { openid, unionid } = session
  if (!openid) {
    throw new Error('failed to obtain openid for upgrade')
  }

  const localUser = await getUserById(user_id)
  if (!localUser) {
    throw new Error('local user not found')
  }
  if (localUser.account_type !== 'local') {
    throw new Error('only local accounts can be upgraded')
  }

  const now = Date.now()
  let targetUser = await usersCollection.where({ openid }).get().then(transformFirst)

  if (!targetUser) {
    await usersCollection.doc(localUser._id).update({
      account_type: 'weixin',
      openid,
      unionid,
      device_id: '',
      last_login_at: now,
      ...platformUpdate(platform)
    })
    targetUser = applyPlatform(
      {
        ...localUser,
        account_type: 'weixin',
        openid,
        unionid,
        device_id: '',
        last_login_at: now
      },
      platform
    )
  } else {
    const mergedStats = mergeStats(localUser.stats, targetUser.stats)
    await usersCollection.doc(targetUser._id).update({
      stats: mergedStats,
      last_login_at: now,
      unionid: unionid || targetUser.unionid,
      ...platformUpdate(platform)
    })
    await usersCollection.doc(localUser._id).update({ merged_to: targetUser._id, merged_at: now })
    targetUser = applyPlatform(
      {
        ...targetUser,
        stats: mergedStats,
        last_login_at: now,
        unionid: unionid || targetUser.unionid
      },
      platform
    )
  }

  const token = createToken({ user_id: targetUser._id, account_type: 'weixin' })
  return { token, user: sanitizeUser(targetUser) }
}

async function fetchWeixinSession(code) {
  const { appid, secret } = loadWeixinConfig()
  if (!appid || !secret) {
    throw new Error('WX_APPID/WX_SECRET not configured')
  }

  const url =
    'https://api.weixin.qq.com/sns/jscode2session?appid=' +
    encodeURIComponent(appid) +
    '&secret=' +
    encodeURIComponent(secret) +
    '&js_code=' +
    encodeURIComponent(code) +
    '&grant_type=authorization_code'

  const res = await uniCloud.httpclient.request(url, { dataType: 'json', method: 'GET', timeout: 5000 })
  if (res.status !== 200 || !res.data) {
    throw new Error('failed to call jscode2session')
  }
  if (res.data.errcode) {
    throw new Error(`jscode2session error: ${res.data.errmsg || res.data.errcode}`)
  }
  return res.data
}

function loadWeixinConfig() {
  const config = uniCloud.getConfig && uniCloud.getConfig()
  const mpConfig = (config && (config.mp || config.weixin)) || {}
  return {
    appid: process.env.WX_APPID || process.env.MP_WEIXIN_APPID || mpConfig.appid || (mpConfig.mp && mpConfig.mp.appid),
    secret: process.env.WX_SECRET || process.env.MP_WEIXIN_SECRET || mpConfig.secret || (mpConfig.mp && mpConfig.mp.secret)
  }
}

async function getUserById(userId) {
  return usersCollection.doc(userId).get().then(transformFirst)
}

function transformFirst(res) {
  if (!res || !res.data || !res.data.length) return null
  return res.data[0]
}

function applyPlatform(user, platform) {
  if (!platform) return user
  const platforms = Array.isArray(user.platforms) ? [...user.platforms] : []
  if (!platforms.includes(platform)) {
    platforms.push(platform)
  }
  return { ...user, platforms }
}

function platformUpdate(platform) {
  if (!platform) return {}
  return { platforms: dbCmd.addToSet(platform) }
}

function sanitizeUser(user) {
  if (!user) return user
  const { device_id, ...rest } = user
  return { ...rest, stats: ensureStats(rest.stats) }
}

function mergeStats(localStats = {}, wechatStats = {}) {
  const local = ensureStats(localStats)
  const remote = ensureStats(wechatStats)
  return {
    score: Math.max(local.score, remote.score),
    coins: local.coins + remote.coins
  }
}

function generateDefaultNickname() {
  return '玩家' + String(Date.now()).slice(-4)
}

function ensureStats(stats = {}) {
  return {
    score: Number(stats.score) || 0,
    coins: Number(stats.coins) || 0
  }
}
