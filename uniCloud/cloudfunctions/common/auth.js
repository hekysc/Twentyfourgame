'use strict'

const crypto = require('crypto')

const TOKEN_SECRET = process.env.TF24_TOKEN_SECRET || process.env.TOKEN_SECRET || 'CHANGE_ME_DEV_ONLY'
const TOKEN_TTL = Number(process.env.TF24_TOKEN_TTL || 60 * 60 * 24 * 30) * 1000 // default 30 days

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(str) {
  const pad = 4 - (str.length % 4 || 4)
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad === 4 ? 0 : pad)
  return Buffer.from(normalized, 'base64').toString()
}

function createToken(payload = {}) {
  const now = Date.now()
  const header = { alg: 'HS256', typ: 'JWT' }
  const body = {
    ...payload,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL) / 1000)
  }
  const segments = [base64UrlEncode(JSON.stringify(header)), base64UrlEncode(JSON.stringify(body))]
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(segments.join('.'))
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${segments.join('.')}.${signature}`
}

function verifyToken(token = '') {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerSeg, payloadSeg, signature] = parts
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${headerSeg}.${payloadSeg}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  if (expectedSig !== signature) return null
  try {
    const payload = JSON.parse(base64UrlDecode(payloadSeg))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null
    }
    return payload
  } catch (err) {
    return null
  }
}

module.exports = {
  createToken,
  verifyToken
}
