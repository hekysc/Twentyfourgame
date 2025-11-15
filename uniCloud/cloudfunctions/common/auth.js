'use strict'
const crypto = require('crypto')

const DEFAULT_SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET'
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30 // 30 days

function getSecret() {
  return process.env.UNICLOUD_TOKEN_SECRET || DEFAULT_SECRET
}

function encode(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url')
}

function decode(str) {
  try {
    return JSON.parse(Buffer.from(str, 'base64url').toString('utf8'))
  } catch (err) {
    return null
  }
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url')
}

function createToken(user) {
  const payload = {
    uid: user._id || user.id,
    issued_at: Date.now(),
    expired_at: Date.now() + TOKEN_TTL
  }
  const payloadB64 = encode(payload)
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

function verifyToken(token = '') {
  if (!token || typeof token !== 'string') return null
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null
  const expected = sign(payloadB64)
  if (expected !== signature) return null
  const payload = decode(payloadB64)
  if (!payload || !payload.uid) return null
  if (payload.expired_at && payload.expired_at < Date.now()) return null
  return { uid: payload.uid }
}

module.exports = { createToken, verifyToken }
