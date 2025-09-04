// 24点求解与表达式计算（分数精度，避免浮点误差）

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b)
  while (b !== 0) { const t = a % b; a = b; b = t }
  return a === 0 ? 1 : Math.abs(a)
}

export class Fraction {
  constructor(n, d) {
    if (d === 0) throw new Error('denominator 0')
    this.n = n
    this.d = d
    this.normSelf()
  }
  static fromInt(x) { return new Fraction(x, 1) }
  normSelf() {
    let n = this.n, d = this.d
    if (d < 0) { n = -n; d = -d }
    const g = gcd(Math.abs(n), Math.abs(d))
    this.n = n / g
    this.d = d / g
  }
  plus(o) { return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d) }
  minus(o) { return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d) }
  times(o) { return new Fraction(this.n * o.n, this.d * o.d) }
  div(o) {
    if (o.n === 0) throw new Error('divide by zero')
    return new Fraction(this.n * o.d, this.d * o.n)
  }
  equalsInt(v) { return this.n === v * this.d }
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}` }
}

export function solve24(nums) {
  if (!nums || nums.length !== 4) throw new Error('need 4 numbers')
  const start = nums.map(x => ({ v: Fraction.fromInt(x), expr: String(x) }))
  const res = dfsSolve(start)
  return res ? res.expr : null
}

function dfsSolve(list) {
  if (list.length === 1) {
    return list[0].v.equalsInt(24) ? list[0] : null
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue
      const rest = []
      for (let k = 0; k < list.length; k++) if (k !== i && k !== j) rest.push(list[k])
      const a = list[i], b = list[j]

      // +
      {
        const ve = { v: a.v.plus(b.v), expr: `(${a.expr}+${b.expr})` }
        const ans = dfsSolve(rest.concat([ve]))
        if (ans) return ans
      }
      // -
      {
        const ve = { v: a.v.minus(b.v), expr: `(${a.expr}-${b.expr})` }
        const ans = dfsSolve(rest.concat([ve]))
        if (ans) return ans
      }
      // ×
      {
        const ve = { v: a.v.times(b.v), expr: `(${a.expr}×${b.expr})` }
        const ans = dfsSolve(rest.concat([ve]))
        if (ans) return ans
      }
      // ÷
      if (b.v.n !== 0) {
        const ve = { v: a.v.div(b.v), expr: `(${a.expr}÷${b.expr})` }
        const ans = dfsSolve(rest.concat([ve]))
        if (ans) return ans
      }
    }
  }
  return null
}

export function generateSolvable() {
  // 反复随机直到有解（搜索空间小）
  // 避免死循环：理论上可解组合足够多，基本能快速返回
  // 若要更稳，可添加计数器上限，这里保持简单
  // 1..13
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const nums = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13))
    const sol = solve24(nums)
    if (sol) return { nums, sol }
  }
}

export function validateUsesAllCards(expr, cards) {
  if (!expr) return false
  const re = /(10|11|12|13|[1-9])/g
  const used = []
  let m
  while ((m = re.exec(expr)) !== null) used.push(parseInt(m[0]))
  const need = new Map()
  for (const c of cards) need.set(c, (need.get(c) || 0) + 1)
  const have = new Map()
  for (const u of used) have.set(u, (have.get(u) || 0) + 1)
  for (const [k, cnt] of have) {
    const allow = need.get(k) || 0
    if (cnt > allow) return false
    need.set(k, allow - cnt)
  }
  for (const v of need.values()) if (v !== 0) return false
  return true
}

export function evaluateExprToFraction(expr) {
  // 1) 词法
  const tokens = []
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (/\s/.test(c)) { i++; continue }
    if ('()+-×÷'.includes(c)) { tokens.push({ t: c }); i++; continue }
    if (/\d/.test(c)) {
      let j = i + 1
      while (j < expr.length && /\d/.test(expr[j])) j++
      tokens.push({ t: expr.slice(i, j) })
      i = j; continue
    }
    return null // 非法字符
  }
  // 2) Shunting-yard
  const prec = op => (op === '+' || op === '-') ? 1 : (op === '×' || op === '÷') ? 2 : 0
  const output = []
  const stack = []
  for (const t of tokens) {
    if (/^\d/.test(t.t)) output.push(t)
    else if (t.t === '(') stack.push(t)
    else if (t.t === ')') {
      while (stack.length && stack[stack.length - 1].t !== '(') output.push(stack.pop())
      if (!stack.length || stack[stack.length - 1].t !== '(') return null
      stack.pop()
    } else if ('+-×÷'.includes(t.t)) {
      while (stack.length) {
        const top = stack[stack.length - 1].t
        if ('+-×÷'.includes(top) && prec(top) >= prec(t.t)) output.push(stack.pop())
        else break
      }
      stack.push(t)
    } else return null
  }
  while (stack.length) {
    const op = stack.pop()
    if (op.t === '(') return null
    output.push(op)
  }
  // 3) 计算RPN
  const st = []
  for (const t of output) {
    if (/^\d/.test(t.t)) st.push(Fraction.fromInt(parseInt(t.t)))
    else {
      if (st.length < 2) return null
      const b = st.pop()
      const a = st.pop()
      let r
      if (t.t === '+') r = a.plus(b)
      else if (t.t === '-') r = a.minus(b)
      else if (t.t === '×') r = a.times(b)
      else if (t.t === '÷') { if (b.n === 0) return null; r = a.div(b) }
      else return null
      st.push(r)
    }
  }
  return st.length === 1 ? st[0] : null
}

