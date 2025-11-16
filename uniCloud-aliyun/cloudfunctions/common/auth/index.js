const crypto = require('crypto')

const TOKEN_SECRET = process.env.TF24_TOKEN_SECRET || 'TF24_DEV_SECRET_CHANGE_ME'
const TOKEN_TTL = 60 * 60 * 24 * 15 // 15 days

function base64UrlEncode(input) {
  const buff = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buff.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(str = '') {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  return Buffer.from(str, 'base64').toString('utf8')
}

function sign(data) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url')
}

function createToken(user, options = {}) {
  if (!user || !user._id) {
    throw new Error('无法为匿名用户生成 token')
  }
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    uid: user._id,
    account_type: user.account_type,
    device_id: user.device_id || '',
    openid: user.openid || '',
    iat: now,
    exp: now + (options.ttl || TOKEN_TTL),
  }
  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(`${headerEncoded}.${payloadEncoded}`)
  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('token 缺失')
  }
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('token 结构无效')
  }
  const [headerEncoded, payloadEncoded, signature] = parts
  const expected = sign(`${headerEncoded}.${payloadEncoded}`)
  if (signature !== expected) {
    throw new Error('token 签名无效')
  }
  const payload = JSON.parse(base64UrlDecode(payloadEncoded))
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp && payload.exp < now) {
    throw new Error('token 已过期')
  }
  return payload
}

module.exports = {
  createToken,
  verifyToken,
}
