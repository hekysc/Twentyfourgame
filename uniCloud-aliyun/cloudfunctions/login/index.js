'use strict'
const auth = require('auth')
const db = uniCloud.database()
const userCollection = db.collection('user')

const config = require('config')
const WX_APPID = config.wx.appid
const WX_SECRET = config.wx.secret
// const WX_APPID = process.env.WX_APPID || 'wx58faf81d08ca037c'
// const WX_SECRET = process.env.WX_SECRET || 'e63e396980073dfb9ad3f3390039c3ab'


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
  return cloned
}

async function handleMpWeixin(scenePayload = {}) {
  const { code, platform = 'mp-weixin', phoneNumber = '' } = scenePayload
  const session = await fetchWeixinSession(code)
  const openid = session.openid
  let userDoc = await userCollection.where({ openid }).limit(1).get()
  let user = userDoc.data[0]
  if (!user) {
    const newUser = {
      openid,
      unionid: session.unionid || '',
      nickname: '',
      avatar_url: '',
      avatar_file_id: '',
      gender: 0,
      phone: phoneNumber || '',
      device_id: '',
      platforms: [platform],
      created_at: Date.now(),
      last_login_at: Date.now(),
      profile_completed: false,
      stats: { score: 0, coins: 0 }
    }
    const res = await userCollection.add(newUser)
    user = { _id: res.id, ...newUser }
  } else {
    const now = Date.now()
    user.last_login_at = now
    user.platforms = Array.from(new Set([...(user.platforms || []), platform]))
    const updatePayload = {
      last_login_at: user.last_login_at,
      platforms: user.platforms
    }
    if (phoneNumber) {
      user.phone = phoneNumber
      updatePayload.phone = phoneNumber
    }
    await userCollection.doc(user._id).update(updatePayload)
  }
  const token = auth.createToken(user)
  return { token, user: sanitizeUser(user) }
}

async function handleApp(scenePayload = {}) {
  const { deviceId, phone = '', platform = 'app-plus', extra = {} } = scenePayload
  if (!deviceId && !phone) {
    throw new Error('缺少 deviceId 或 phone')
  }
  let query = deviceId ? { device_id: deviceId } : { phone }
  let userDoc = await userCollection.where(query).limit(1).get()
  let user = userDoc.data[0]
  if (!user) {
    const newUser = {
      openid: '',
      unionid: '',
      device_id: deviceId || '',
      phone,
      nickname: extra.nickname || '游客',
      avatar_url: extra.avatar_url || '',
      avatar_file_id: extra.avatar_file_id || '',
      gender: extra.gender || 0,
      platforms: [platform],
      created_at: Date.now(),
      last_login_at: Date.now(),
      profile_completed: !!(extra.nickname && extra.avatar_url),
      stats: { score: 0, coins: 0 }
    }
    const res = await userCollection.add(newUser)
    user = { _id: res.id, ...newUser }
  } else {
    user.last_login_at = Date.now()
    user.platforms = Array.from(new Set([...(user.platforms || []), platform]))
    await userCollection.doc(user._id).update({
      last_login_at: user.last_login_at,
      platforms: user.platforms
    })
  }
  const token = auth.createToken(user)
  return { token, user: sanitizeUser(user) }
}

exports.main = async (event = {}, context) => {
  const { scene, code, deviceId, phone, platform, extra, phoneNumber } = event
  if (scene === 'mp-weixin') {
    return await handleMpWeixin({ code, platform, phoneNumber: phoneNumber || phone || '' })
  }
  if (scene === 'app') {
    return await handleApp({ deviceId, phone: phone || phoneNumber || '', platform, extra })
  }
  throw new Error('不支持的登录场景')
}
