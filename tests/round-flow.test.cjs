const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { parse } = require('@babel/parser')

// Execute the actual page handlers with a deterministic clock and deferred network.
// No copied timer/settlement implementation: extraction fails if a handler is removed.
const source = fs.readFileSync('pages/index/index.vue', 'utf8').split('<script setup>')[1].split('</script>')[0]
const ast = parse(source, { sourceType: 'module' })
const names = ['startHandTimer', 'pauseHandTimer', 'freezeHandTimer', 'currentHandElapsedMs',
  'notifyLongTime', 'resetHandStateForNext', 'finishHand', 'settleHandResult', 'check',
  'showSolution', 'skipHand', 'nextHand', 'persistOnline', 'applyBasicCombination', 'undoBasicStep']
const handlers = names.map(name => {
  const node = ast.program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name)
  assert.ok(node, `Missing handler: ${name}`)
  return source.slice(node.start, node.end)
}).join('\n')
function deferred() {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}
async function harness({ online = false, mode = 'pro' } = {}) {
  const solver = await import('../utils/solver.js')
  const calc = await import('../utils/calc.js')
  const basic = await import('../core/basic-mode.js')
  let now = 1000, id = 0
  const timers = new Map(), records = [], requests = [], hints = []
  const cloud = deferred(), draw = deferred()
  const cards = [1, 2, 3, 4].map((rank, i) => ({ rank, suit: ['S', 'H', 'D', 'C'][i] }))
  const ref = value => ({ value })
  const s = {
    ...solver, ...calc, ...basic, Date: class extends Date { static now() { return now } },
    pageAlive: true, pageVisible: true, pendingSettlement: null,
    successAdvanceTimer: null, errorFeedbackTimer: null, handTimer: null,
    setTimeout(fn, delay) { const n = ++id; timers.set(n, { at: now + delay, fn }); return n },
    clearTimeout(n) { timers.delete(n) },
    setInterval(fn, delay) { const n = ++id; timers.set(n, { at: now + delay, fn, interval: delay }); return n },
    clearInterval(n) { timers.delete(n) },
    isOnline: () => online, hasOnlineRound: () => true,
    finishOnlineRound(arg, kind) { requests.push({ arg, kind }); return cloud.promise },
    handleConnectionFailure(e) { s.failure = e },
    pushRound(r) { records.push(r) }, recordRoundResult() {},
    saveSession() {}, updateLastSuccess() {}, scheduleTabWarmup() {},
    showHint(msg) { hints.push(msg) }, showExpressionErrorToast() { hints.push('invalid') },
    showBasicError() {}, applyPendingGameplayPrefs() {}, closeTimerPopover() {},
    updateExprHeight() {}, syncBasicOpsHeight() {}, nextTick: () => Promise.resolve(),
    getNextDraw() { s.drawRequests++; return online ? draw.promise : Promise.resolve({cards, solution:'(1+3)×(2+4)'}) },
    drawRequests: 0,
  }
  for (const [key, value] of Object.entries({dealing:false, handReady:true, networkBusy:false,
    handSettled:false, settledResult:null, handRecorded:false, longTimeNotified:false,
    handStartTs:1000, nowTs:1000, handStoppedAtTs:0, attemptCount:0, hintWasUsed:false,
    errorAnimating:false, successAnimating:false, errorValueText:'', exprOverrideText:'',
    handsPlayed:0, successCount:0, failCount:0, selectedUserId:'local', currentHandNums:[1,2,3,4],
    currentHandSource:'regular', currentMistakeKey:'', faceUseHigh:false, cards,
    deck:[], solution:'(1+3)×(2+4)', tokens:[], usedByCard:[0,0,0,0], skipInProgress:false,
    mode, basicSelection:{first:null,operator:null}})) s[key] = ref(value)
  const state = basic.createBasicState(cards, false)
  s.basicSlots = ref(state.slots); s.basicHistory = ref([])
  s.basicExpression = ref(state.expression); s.basicDisplayExpression = ref(state.displayExpression)
  s.expr = {get value() { return calc.tokensToExpression(s.tokens.value, false) }}
  s.canEditHand = {get value() {return s.handReady.value && !s.dealing.value && !s.networkBusy.value && !s.handSettled.value}}
  vm.createContext(s)
  vm.runInContext(handlers, s)
  s.startHandTimer()
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
  async function advance(ms) {
    const end = now + ms
    for (;;) {
      const entry = [...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0]
      if (!entry) break
      const [key,t] = entry; now = t.at
      if (t.interval) t.at += t.interval; else timers.delete(key)
      t.fn(); await flush()
    }
    now = end; await flush()
  }
  function submit(expr) {
    s.tokens.value = [...expr].map(value => ({type:/\d/.test(value)?'num':'op',value}))
    s.usedByCard.value = [1,1,1,1]
    s.check()
  }
  return {s, advance, submit, cloud, draw, flush, cards, records, requests, hints}
}

test('Pro wrong answers keep the original clock; correct answer freezes and advances exactly after 500ms', async () => {
  const h = await harness()
  await h.advance(8000); h.submit('1+2+3+4')
  await h.advance(7000); h.submit('1+2+3+4')
  assert.equal(h.records.length,0); assert.equal(h.s.handsPlayed.value,0)
  assert.equal(h.s.handStoppedAtTs.value,0)
  await h.advance(8000); h.submit('(1+3)×(2+4)')
  assert.equal(h.records.length,1); assert.equal(h.records[0].timeMs,23000)
  assert.equal(h.records[0].retries,2); assert.equal(h.s.successCount.value,1)
  h.submit('(1+3)×(2+4)'); assert.equal(h.records.length,1)
  await h.advance(499); assert.equal(h.s.currentHandElapsedMs(),23000); assert.equal(h.s.drawRequests,0)
  await h.advance(1); assert.equal(h.s.drawRequests,1); assert.equal(h.s.currentHandElapsedMs(),0)
})

test('Basic final wrong result can be undone and solved without counting the wrong attempt', async () => {
  const h = await harness({mode:'basic'})
  await h.advance(8000)
  h.s.applyBasicCombination(0,2,'+')
  h.s.applyBasicCombination(1,3,'+')
  h.s.applyBasicCombination(2,3,'+')
  assert.equal(h.s.attemptCount.value,1); assert.equal(h.records.length,0)
  assert.equal(h.s.canEditHand.value,true); assert.equal(h.s.handStoppedAtTs.value,0)
  h.s.undoBasicStep()
  await h.advance(7000)
  h.s.applyBasicCombination(2,3,'×')
  assert.equal(h.records.length,1); assert.equal(h.records[0].success,true)
  assert.equal(h.records[0].timeMs,15000); assert.equal(h.records[0].retries,1)
})

test('120 seconds is a one-time reminder, not a failure or a stopped clock', async () => {
  const h = await harness()
  await h.advance(130000)
  assert.equal(h.hints.length,1); assert.equal(h.records.length,0)
  assert.equal(h.s.handStoppedAtTs.value,0)
  h.submit('(1+3)×(2+4)')
  assert.equal(h.records[0].success,true); assert.equal(h.records[0].timeMs,130000)
})

test('answer reveal stops immediately and subsequent answer/skip cannot score the hand twice', async () => {
  const h = await harness()
  await h.advance(6000); h.s.showSolution()
  assert.equal(h.records.length,1); assert.equal(h.records[0].success,false)
  assert.equal(h.s.failCount.value,1)
  await h.advance(4000); h.s.showSolution(); h.submit('(1+3)×(2+4)')
  assert.equal(h.s.currentHandElapsedMs(),6000); assert.equal(h.records.length,1)
  await h.s.skipHand(); assert.equal(h.records.length,1); assert.equal(h.s.drawRequests,1)
})

test('slow online settlement does not extend the clock or the 500ms success feedback', async () => {
  const h = await harness({online:true})
  await h.advance(8000); h.submit('1+2+3+4')
  assert.equal(h.requests.length,0)
  await h.advance(15000); h.submit('(1+3)×(2+4)')
  assert.equal(h.requests.length,1); assert.equal(h.s.currentHandElapsedMs(),23000)
  await h.advance(500)
  assert.equal(h.s.successAnimating.value,false); assert.equal(h.s.dealing.value,true)
  assert.equal(h.s.drawRequests,0)
  await h.advance(3000); assert.equal(h.s.currentHandElapsedMs(),23000)
  h.cloud.resolve({settled:true,success:true}); await h.flush()
  assert.equal(h.s.drawRequests,1); assert.equal(h.s.dealing.value,true)
  await h.advance(2000); assert.equal(h.s.currentHandElapsedMs(),23000)
  h.draw.resolve({cards:h.cards,solution:'(1+3)×(2+4)'}); await h.flush()
  assert.equal(h.s.currentHandElapsedMs(),0); assert.equal(h.s.dealing.value,false)
})

test('online hint settles immediately; double skip waits for the same request and issues one new hand', async () => {
  const h = await harness({online:true})
  await h.advance(2000); h.s.showSolution()
  assert.equal(h.requests.length,1); assert.equal(h.s.handStoppedAtTs.value,3000)
  const a = h.s.skipHand(), b = h.s.skipHand()
  assert.equal(h.requests.length,1)
  h.cloud.resolve({settled:true,success:false}); await h.flush()
  h.draw.resolve({cards:h.cards}); await Promise.all([a,b])
  assert.equal(h.s.drawRequests,1); assert.equal(h.s.handsPlayed.value,1)
})

test('pausing display refresh counts background time, but a frozen hand cannot restart', async () => {
  const h = await harness()
  await h.advance(2000); h.s.pageVisible=false; h.s.pauseHandTimer()
  await h.advance(10000); h.s.pageVisible=true; h.s.startHandTimer()
  assert.equal(h.s.currentHandElapsedMs(),12000)
  h.s.showSolution(); h.s.pauseHandTimer()
  await h.advance(10000); h.s.startHandTimer()
  assert.equal(h.s.currentHandElapsedMs(),12000); assert.equal(h.s.handTimer,null)
})

test('skip ends an unanswered local hand once, preserving its elapsed time', async () => {
  const h = await harness()
  await h.advance(4200)
  await Promise.all([h.s.skipHand(), h.s.skipHand()])
  assert.equal(h.records.length,1); assert.equal(h.records[0].success,false)
  assert.equal(h.records[0].timeMs,4200); assert.equal(h.s.drawRequests,1)
})

test('failed online settlement does not start another round', async () => {
  const h = await harness({online:true})
  await h.advance(5000); h.submit('(1+3)×(2+4)')
  await h.advance(500)
  h.cloud.resolve({settled:false,success:false}); await h.flush()
  assert.ok(h.s.failure); assert.equal(h.s.drawRequests,0)
  assert.equal(h.s.currentHandElapsedMs(),5000)
})
