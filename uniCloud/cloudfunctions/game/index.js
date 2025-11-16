'use strict'
const auth = require('../common/auth.js')
const db = uniCloud.database()
const recordCollection = db.collection('game_record')

function pickToken(event = {}) {
  if (event.token) return event.token
  const authHeader = event.headers?.Authorization || event.headers?.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return ''
}

async function ensureLogin(event) {
  const token = pickToken(event)
  const verified = auth.verifyToken(token)
  if (!verified) {
    throw new Error('NOT_LOGIN')
  }
  return verified.uid
}

module.exports = async (event = {}, context) => {
  const action = event.action || 'listRecords'
  try {
    const uid = await ensureLogin(event)
    if (action === 'listRecords') {
      const { limit = 20 } = event.data || {}
      const res = await recordCollection.where({ uid }).orderBy('created_at', 'desc').limit(limit).get()
      return { code: 0, list: res.data }
    }
    if (action === 'saveRecord') {
      const { puzzle = [], success = false, time_spent = 0 } = event.data || {}
      await recordCollection.add({
        uid,
        puzzle,
        success,
        time_spent,
        created_at: Date.now()
      })
      return { code: 0 }
    }
    return { code: 404, message: 'UNKNOWN_ACTION' }
  } catch (err) {
    if (err.message === 'NOT_LOGIN') {
      return { code: 401, message: 'NOT_LOGIN' }
    }
    return { code: 500, message: err.message }
  }
}
