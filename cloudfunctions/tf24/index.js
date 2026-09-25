const cloud = require('wx-server-sdk'),
  crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database(),
  $ = db.command
const R = require('./rules')
const APPID = 'wx58faf81d08ca037c'
const BATCH_TTL = 7 * 24 * 60 * 60 * 1000
const OPEN_BATCH_TTL = 30 * 24 * 60 * 60 * 1000
const clean = (obj) => {
  const { _id, ...rest } = obj
  return rest
}
async function get(coll, id) {
  const r = await db.collection(coll).where({ _id: id }).limit(1).get()
  return r.data[0] || null
}
async function ensure(coll, id, data) {
  if (await get(coll, id)) return
  try {
    await db.collection(coll).add({ data: { _id: id, ...data } })
  } catch (e) {
    if (!(await get(coll, id))) throw e
  }
}
async function txget(tx, coll, id) {
  return (await tx.collection(coll).doc(id).get()).data
}
function sanitizePrefs(p = {}) {
  return {
    lastMode: p.lastMode === 'pro' ? 'pro' : 'basic',
    rankMode: p.rankMode === 'jqk-11-12-13' ? 'jqk-11-12-13' : 'jqk-1',
    deckSource: ['regular', 'mistakes', 'mix'].includes(p.deckSource)
      ? p.deckSource
      : 'regular',
    mixWeight: Math.max(0, Math.min(100, Number(p.mixWeight) || 50)),
    haptics: p.haptics !== false,
    sfx: p.sfx !== false,
    reducedMotion: !!p.reducedMotion,
  }
}
async function profile(uid) {
  await ensure('tf24_users', uid, {
    name: '微信玩家',
    avatar: '',
    createdAt: Date.now(),
    prefs: sanitizePrefs(),
    book: { active: {}, ledger: {} },
    deck: [],
    activeBatchId: '',
  })
  await ensure('tf24_stats', `${uid}_all`, R.emptyAggregate(uid, 'all'))
  return get('tf24_users', uid)
}
async function scan(coll, condition) {
  const out = []
  let cursor = ''
  for (;;) {
    const where = cursor ? { ...condition, _id: $.gt(cursor) } : condition
    const { data } = await db
      .collection(coll)
      .where(where)
      .orderBy('_id', 'asc')
      .limit(100)
      .get()
    out.push(...data)
    if (data.length < 100) return out
    cursor = data[data.length - 1]._id
  }
}
async function cleanExpiredBatches(uid, now) {
  const { data = [] } = await db
    .collection('tf24_question_batches')
    .where({ uid })
    .limit(100)
    .get()
  const expired = data.filter((item) => item.expiresAt <= now)
  for (const batch of expired) {
    await db.collection('tf24_question_batches').doc(batch._id).remove()
  }
  const user = await get('tf24_users', uid)
  if (user?.activeBatchId && expired.some((batch) => batch._id === user.activeBatchId))
    await db.collection('tf24_users').doc(uid).update({ data: { activeBatchId: '' } })
}
function publicBatch(batch) {
  return {
    id: batch.id || batch._id,
    createdAt: batch.createdAt,
    expiresAt: batch.expiresAt,
    questions: batch.questions
      .filter((q) => q.status !== 'settled')
      .map((q) => ({
        id: q.id,
        cards: q.cards,
        remaining: q.remaining,
      })),
  }
}
async function settleQueuedRound(uid, item, now) {
  const period = R.weekKey(now)
  await ensure('tf24_stats', `${uid}_${period}`, R.emptyAggregate(uid, period))
  return db.runTransaction(async (tx) => {
    const batch = await txget(tx, 'tf24_question_batches', item.batchId)
    if (batch.uid !== uid || batch.expiresAt <= now)
      throw new Error('预发题目已过期')
    const question = (batch.questions || []).find((q) => q.id === item.questionId)
    if (!question) throw new Error('题目不属于此预发批次')
    if (question.status === 'settled') return { ...question.result, duplicate: true }

    const kind = item.kind
    if (!['answer', 'skip', 'hint'].includes(kind)) throw new Error('无效成绩')
    const practice = item.practice === true
    const user = await txget(tx, 'tf24_users', uid)
    let cards = question.cards
    if (practice) {
      const key = String(item.mistakeKey || '')
      const mistake = user.book?.active?.[key]
      if (!mistake) throw new Error('错题已移除，无法同步本次练习')
      cards = mistake.nums.map((rank, i) => ({ rank, suit: ['S', 'H', 'D', 'C'][i] }))
    }
    const high = item.high === true
    const expression = String(item.expr || '').slice(0, 160)
    const success = kind === 'answer' && R.validExpression(expression, cards, high)
    if (kind === 'answer' && !success) return { settled: false, success: false }

    const timeMs = Math.max(1, Math.min(24 * 60 * 60 * 1000, Math.floor(Number(item.timeMs) || 1)))
    const round = {
      id: question.id,
      uid,
      ts: now,
      success,
      timeMs,
      expr: expression,
      hand: { cards },
      faceUseHigh: high,
      hintUsed: kind === 'hint',
      ops: expression.match(/[+\-×÷]/g) || [],
      mode: item.mode === 'pro' ? 'pro' : 'basic',
    }
    const book = R.updateBook(user.book, cards, success, now)
    await tx.collection('tf24_users').doc(uid).update({ data: { book } })

    let aggregate = null
    if (!practice) {
      for (const key of ['all', period]) {
        const a = await txget(tx, 'tf24_stats', `${uid}_${key}`)
        const updated = R.updateAggregate(clean(a), round)
        await tx.collection('tf24_stats').doc(`${uid}_${key}`).set({ data: updated })
        if (key === 'all') aggregate = updated
      }
      await tx.collection('tf24_rounds').doc(question.id).set({ data: round })
    }

    const result = { settled: true, success, round: practice ? null : round, total: aggregate, book }
    question.status = 'settled'
    question.result = result
    const allSettled = batch.questions.every((q) => q.status === 'settled')
    if (allSettled) {
      batch.status = 'closed'
      batch.expiresAt = now + BATCH_TTL
    } else {
      batch.expiresAt = now + OPEN_BATCH_TTL
    }
    await tx.collection('tf24_question_batches').doc(item.batchId).update({
      data: {
        questions: batch.questions,
        status: batch.status,
        expiresAt: batch.expiresAt,
        closedAt: allSettled ? now : batch.closedAt || null,
      },
    })
    if (allSettled && user.activeBatchId === item.batchId)
      await tx.collection('tf24_users').doc(uid).update({ data: { activeBatchId: '' } })
    return result
  })
}
exports.main = async (event) => {
  try {
    const ctx = cloud.getWXContext()
    if (!ctx.OPENID || ctx.APPID !== APPID)
      throw new Error('请通过本小程序微信登录')
    const uid = crypto
      .createHash('sha256')
      .update(ctx.APPID + ':' + ctx.OPENID)
      .digest('hex')
      .slice(0, 32)
    const action = event.action,
      now = Date.now()
    if (action === 'login' || action === 'snapshot') {
      const p = await profile(uid),
        total = await get('tf24_stats', `${uid}_all`)
      return {
        ok: true,
        data: {
          user: { id: uid, name: p.name, avatar: p.avatar, color: '#dce9df' },
          prefs: p.prefs,
          book: p.book,
          total,
        },
      }
    }
    const p = await get('tf24_users', uid)
    if (!p) throw new Error('请先登录')
    if (action === 'prefetch') {
      await cleanExpiredBatches(uid, now)
      const batch = await db.runTransaction(async (tx) => {
        const user = await txget(tx, 'tf24_users', uid)
        let activeId = user.activeBatchId || ''
        if (event.closeBatchId && event.closeBatchId === activeId) {
          try {
            const previous = await txget(tx, 'tf24_question_batches', activeId)
            previous.status = 'closed'
            previous.closedAt = now
            await tx.collection('tf24_question_batches').doc(activeId).update({
              data: { status: 'closed', closedAt: now, expiresAt: now + BATCH_TTL },
            })
          } catch (_) {}
          activeId = ''
        }
        if (activeId) {
          try {
            const existing = await txget(tx, 'tf24_question_batches', activeId)
            if (existing.uid === uid && existing.status === 'open' && existing.expiresAt > now &&
              existing.questions.some((q) => q.status !== 'settled')) {
              existing.expiresAt = now + OPEN_BATCH_TTL
              await tx.collection('tf24_question_batches').doc(activeId).update({ data: { expiresAt: existing.expiresAt } })
              return existing
            }
          } catch (_) {}
          activeId = ''
        }
        const questions = R.drawPack().map((q) => ({
          id: crypto.randomBytes(16).toString('hex'),
          cards: q.cards,
          remaining: q.remaining,
          status: 'open',
        }))
        if (!questions.length) throw new Error('暂时无法生成整副题目，请重试')
        const id = crypto.randomBytes(16).toString('hex')
        const created = {
          uid,
          status: 'open',
          createdAt: now,
          expiresAt: now + OPEN_BATCH_TTL,
          questions,
        }
        await tx.collection('tf24_question_batches').doc(id).set({ data: created })
        await tx.collection('tf24_users').doc(uid).update({ data: { activeBatchId: id } })
        return { ...created, id }
      })
      return { ok: true, data: publicBatch(batch) }
    }
    if (action === 'syncBatch') {
      const results = Array.isArray(event.results) ? event.results.slice(0, 13) : []
      const settled = []
      for (const item of results) {
        try {
          settled.push({ questionId: item.questionId, ...(await settleQueuedRound(uid, item, now)) })
        } catch (e) {
          settled.push({ questionId: item.questionId, settled: false, error: e.message })
        }
      }
      return { ok: true, data: { settled } }
    }
    if (action === 'history') {
      const condition = { uid }
      if (event.cursor) condition._id = $.gt(String(event.cursor))
      const { data } = await db
        .collection('tf24_rounds')
        .where(condition)
        .orderBy('_id', 'asc')
        .limit(100)
        .get()
      return {
        ok: true,
        data: {
          rows: data.map(clean),
          cursor: data.length === 100 ? data[data.length - 1]._id : '',
        },
      }
    }
    if (action === 'prefs') {
      const prefs = sanitizePrefs(event.prefs)
      await db.collection('tf24_users').doc(uid).update({ data: { prefs } })
      return { ok: true, data: prefs }
    }
    if (action === 'profile') {
      const name = String(event.name || '').trim()
      if (!name || [...name].length > 20) throw new Error('昵称需为1至20个字符')
      const avatar = String(event.avatar || '')
      if (
        avatar &&
        !avatar.startsWith(
          `cloud://${process.env.TCB_ENV || process.env.SCF_NAMESPACE}.`,
        )
      )
        throw new Error('头像须上传至本环境')
      // Content review uses the authenticated user's OpenID; reject on review failure.
      const review = await cloud.openapi.security.msgSecCheck({
        openid: ctx.OPENID,
        scene: 1,
        version: 2,
        content: name,
      })
      if (review.result?.suggest !== 'pass')
        throw new Error('昵称未通过内容检查，请修改')
      if (avatar) {
        const file = await cloud.downloadFile({ fileID: avatar })
        if (file.fileContent.length > 2 * 1024 * 1024)
          throw new Error('头像需小于2MB')
        await cloud.openapi.security.imgSecCheck({
          media: { contentType: 'image/png', value: file.fileContent },
        })
      }
      await db
        .collection('tf24_users')
        .doc(uid)
        .update({ data: { name, avatar } })
      return { ok: true, data: { id: uid, name, avatar, color: '#dce9df' } }
    }
    if (action === 'start') {
      const high = event.high === true,
        practice = event.practice === true,
        id = crypto.randomBytes(16).toString('hex')
      await ensure('tf24_sessions', uid, { id: '', status: 'void' })
      const result = await db.runTransaction(async (tx) => {
        const user = await txget(tx, 'tf24_users', uid)
        let hand
        if (practice) {
          const key = String(event.mistakeKey || ''),
            item = user.book.active[key]
          if (!item) throw new Error('该错题已移除，请刷新错题本')
          hand = {
            cards: item.nums.map((rank, i) => ({
              rank,
              suit: ['S', 'H', 'D', 'C'][i],
            })),
            deck: user.deck,
          }
        } else hand = R.draw(event.resetDeck ? [] : user.deck, high)
        const session = {
          id,
          uid,
          cards: hand.cards,
          high,
          practice,
          startedAt: now,
          status: 'open',
          mode: event.mode === 'pro' ? 'pro' : 'basic',
        }
        await tx.collection('tf24_sessions').doc(uid).set({ data: session })
        await tx
          .collection('tf24_users')
          .doc(uid)
          .update({ data: { deck: hand.deck } })
        return { id, cards: hand.cards, remaining: hand.deck.length }
      })
      return { ok: true, data: result }
    }
    if (action === 'void') {
      await db.runTransaction(async (tx) => {
        const s = await txget(tx, 'tf24_sessions', uid)
        if (s.id === event.id && s.status === 'open')
          await tx
            .collection('tf24_sessions')
            .doc(uid)
            .update({ data: { status: 'void' } })
      })
      return { ok: true, data: {} }
    }
    if (action === 'finish') {
      const period = R.weekKey(now)
      await ensure(
        'tf24_stats',
        `${uid}_${period}`,
        R.emptyAggregate(uid, period),
      )
      const result = await db.runTransaction(async (tx) => {
        const s = await txget(tx, 'tf24_sessions', uid)
        if (s.id !== event.id) throw new Error('此题已失效，请重新开始')
        if (s.status === 'done') return { ...s.result, settled: true }
        if (s.status !== 'open') throw new Error('此题已作废')
        const kind = event.kind
        if (!['answer', 'skip', 'hint', 'timeout'].includes(kind))
          throw new Error('无效成绩')
        const timeMs = Math.max(1, now - s.startedAt)
        const expression = String(event.expr || '').slice(0, 160)
        const success =
          kind === 'answer' &&
          R.validExpression(expression, s.cards, s.high)
        // Incorrect attempts and legacy timeout requests leave the round open.
        // Never update history, rankings or the mistake book for an attempt.
        if (kind === 'timeout' || (kind === 'answer' && !success)) {
          return { settled: false, success: false, round: null, total: null, book: p.book }
        }
        const round = {
          id: s.id,
          uid,
          ts: now,
          success,
          timeMs,
          expr: expression,
          hand: { cards: s.cards },
          faceUseHigh: s.high,
          hintUsed: kind === 'hint',
          ops: expression.match(/[+\-×÷]/g) || [],
          mode: s.mode,
        }
        const user = await txget(tx, 'tf24_users', uid)
        const book = R.updateBook(user.book, s.cards, success, now)
        await tx.collection('tf24_users').doc(uid).update({ data: { book } })
        let aggregate = null
        if (!s.practice) {
          for (const key of ['all', period]) {
            const a = await txget(tx, 'tf24_stats', `${uid}_${key}`)
            const updated = R.updateAggregate(clean(a), round)
            await tx
              .collection('tf24_stats')
              .doc(`${uid}_${key}`)
              .set({ data: updated })
            if (key === 'all') aggregate = updated
          }
          await tx.collection('tf24_rounds').doc(s.id).set({ data: round })
        }
        const result = {
          settled: true,
          round: s.practice ? null : round,
          total: aggregate,
          book,
          success,
        }
        await tx
          .collection('tf24_sessions')
          .doc(uid)
          .update({ data: { status: 'done', result } })
        return result
      })
      return { ok: true, data: result }
    }
    if (action === 'leaderboard') {
      const period = event.period === 'week' ? R.weekKey(now) : 'all',
        metric = event.metric === 'time' ? 'time' : 'rate'
      const stats = await scan('tf24_stats', { period }),
        ranking = R.ranked(stats, metric, period, now)
      const own = ranking.find((r) => r.uid === uid),
        eligible = new Set(
          ranking.filter((r) => r.rank <= 100).map((r) => r.uid),
        )
      eligible.add(uid)
      const names = new Map()
      // Only fetch profiles needed for this result; never return their full names or avatars.
      for (const id of eligible) {
        const u = await get('tf24_users', id)
        names.set(id, u?.name || '玩家')
      }
      const display = (r) => ({
        rank: r.rank,
        name:
          r.uid === uid
            ? names.get(uid)
            : ([...names.get(r.uid)][0] || '玩') + '*',
        isMe: r.uid === uid,
        total: r.total,
        success: r.success,
        rate: r.total ? r.success / r.total : 0,
        bestTimeMs: r.bestTimeMs,
      })
      const ownStats =
        stats.find((r) => r.uid === uid) || R.emptyAggregate(uid, period)
      let reason = ''
      if (!own)
        reason =
          period === 'all' && now - ownStats.lastPlayedAt >= 7 * R.DAY
            ? '完成1题即可激活总榜'
            : metric === 'rate'
              ? `还需完成${Math.max(0, 13 - ownStats.total)}题可上榜`
              : '成功答对1题即可上榜'
      return {
        ok: true,
        data: {
          rows: ranking.filter((r) => r.rank <= 100).map(display),
          me: own
            ? display(own)
            : { ...display({ ...ownStats, rank: null }), reason },
          period,
          metric,
        },
      }
    }
    throw new Error('不支持的操作')
  } catch (e) {
    console.error('tf24 error', e.message)
    return { ok: false, error: e.message || '服务暂不可用' }
  }
}
