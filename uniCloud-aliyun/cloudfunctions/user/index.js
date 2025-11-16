'use strict'
const auth = require('auth')
const db = uniCloud.database()
const userCollection = db.collection('user')

function pickToken(event = {}) {
  if (event.token) return event.token
  const authHeader = event.headers?.Authorization || event.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return ''
}

async function getUser(uid) {
  if (!uid) return null
  const res = await userCollection.doc(uid).get()
  return res.data && res.data[0]
}

function sanitize(user) {
  if (!user) return null
  const clone = { ...user }
  delete clone.password
  return clone
}

exports.main = async (event = {}, context) => {
  const token = pickToken(event)
  const verified = auth.verifyToken(token)
  if (!verified) {
    return { code: 401, message: 'NOT_LOGIN' }
  }
  const action = event.action || 'getProfile'
  const uid = verified.uid
  if (action === 'getProfile') {
    const user = await getUser(uid)
    return { code: 0, user: sanitize(user) }
  }
  if (action === 'updateProfile') {
    const payload = event.data || {}
    const user = await getUser(uid)
    if (!user) {
      return { code: 404, message: 'USER_NOT_FOUND' }
    }
    const updateData = { updated_at: Date.now() }
    let nextNickname = user.nickname || ''
    let nextAvatarUrl = user.avatar_url || ''
    if ('nickname' in payload) {
      const nickname = (payload.nickname || '').trim()
      updateData.nickname = nickname
      nextNickname = nickname
    }
    if ('avatar_url' in payload) {
      updateData.avatar_url = payload.avatar_url || ''
      nextAvatarUrl = updateData.avatar_url
    }
    if ('avatar_file_id' in payload) {
      updateData.avatar_file_id = payload.avatar_file_id || ''
    }
    if ('gender' in payload && typeof payload.gender === 'number') {
      updateData.gender = payload.gender
    }
    if (payload.settings && typeof payload.settings === 'object') {
      updateData.settings = payload.settings
    }
    if (nextNickname && nextAvatarUrl) {
      updateData.profile_completed = true
    }
    await userCollection.doc(uid).update(updateData)
    const merged = sanitize({ ...user, ...updateData })
    return { code: 0, user: merged }
  }
  if (action === 'setPhone') {
    const { phone } = event.data || {}
    if (!phone) {
      return { code: 400, message: 'PHONE_REQUIRED' }
    }
    await userCollection.doc(uid).update({ phone, updated_at: Date.now() })
    const user = await getUser(uid)
    return { code: 0, user: sanitize(user) }
  }
  return { code: 404, message: 'UNKNOWN_ACTION' }
}
