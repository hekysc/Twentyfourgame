package com.example.twentyfourgame

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.abs
import kotlin.random.Random

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(Modifier.fillMaxSize()) {
                    TwentyFourGameScreen()
                }
            }
        }
    }
}

/** --------- 核心数据结构与求解器（分数精度，避免浮点误差） --------- **/

data class Fraction(val n: Long, val d: Long) {
    init {
        require(d != 0L) { "denominator 0" }
    }
    private fun norm(): Fraction {
        var a = n
        var b = d
        if (b < 0) { a = -a; b = -b }
        val g = gcd(abs(a), abs(b))
        return Fraction(a / g, b / g)
    }
    operator fun plus(o: Fraction) = Fraction(n * o.d + o.n * d, d * o.d).norm()
    operator fun minus(o: Fraction) = Fraction(n * o.d - o.n * d, d * o.d).norm()
    operator fun times(o: Fraction) = Fraction(n * o.n, d * o.d).norm()
    operator fun div(o: Fraction): Fraction {
        require(o.n != 0L) { "divide by zero" }
        return Fraction(n * o.d, d * o.n).norm()
    }
    fun equalsInt(v: Int): Boolean = (n == v.toLong() * d)
    override fun toString(): String = if (d == 1L) "$n" else "$n/$d"
    companion object {
        private fun gcd(a: Long, b: Long): Long {
            var x = a; var y = b
            while (y != 0L) { val t = x % y; x = y; y = t }
            return if (x == 0L) 1 else kotlin.math.abs(x)
        }
        fun fromInt(x: Int) = Fraction(x.toLong(), 1)
    }
}

/** 用于保存中间表达式（值+字符串表示） */
data class ValExpr(val v: Fraction, val expr: String)

/** 24点求解：给定四个整数（1..13），返回任意一个等式为24的表达式；若无解返回null */
fun solve24(nums: List<Int>): String? {
    require(nums.size == 4)
    val start = nums.map { ValExpr(Fraction.fromInt(it), it.toString()) }
    val res = dfsSolve(start)
    return res?.expr
}

private fun dfsSolve(list: List<ValExpr>): ValExpr? {
    if (list.size == 1) {
        return if (list[0].v.equalsInt(24)) list[0] else null
    }
    // 从列表任选两项做运算，递归
    for (i in list.indices) {
        for (j in list.indices) {
            if (i == j) continue
            val rest = ArrayList<ValExpr>()
            for (k in list.indices) if (k != i && k != j) rest.add(list[k])
            val a = list[i]; val b = list[j]

            // 加
            run {
                val ve = ValExpr(a.v + b.v, "(${a.expr}+${b.expr})")
                val ans = dfsSolve(rest + ve)
                if (ans != null) return ans
            }
            // 减
            run {
                val ve = ValExpr(a.v - b.v, "(${a.expr}-${b.expr})")
                val ans = dfsSolve(rest + ve)
                if (ans != null) return ans
            }
            // 乘
            run {
                val ve = ValExpr(a.v * b.v, "(${a.expr}×${b.expr})")
                val ans = dfsSolve(rest + ve)
                if (ans != null) return ans
            }
            // 除
            if (b.v.n != 0L) {
                val ve = ValExpr(a.v / b.v, "(${a.expr}÷${b.expr})")
                val ans = dfsSolve(rest + ve)
                if (ans != null) return ans
            }
        }
    }
    return null
}

/** 随机生成一组“保证有解”的四张牌（1..13） */
fun generateSolvable(): Pair<List<Int>, String> {
    while (true) {
        val nums = List(4) { Random.nextInt(1, 14) } // 1..13
        val sol = solve24(nums)
        if (sol != null) return nums to sol
    }
}

/** --------- 简易表达式拼接与校验（只允许使用当局四张牌） --------- **/

/**
 * 校验用户表达式是否合法并仅使用本局四张牌各一次（数值相等但位置不同也必须匹配数量）。
 * - 允许的符号：+ - × ÷ ( )
 * - 数字：1..13，支持两位数（10,11,12,13）
 */
fun validateUsesAllCards(expr: String, cards: List<Int>): Boolean {
    // 抽取数字序列
    val regex = Regex("(10|11|12|13|[1-9])")
    val used = regex.findAll(expr).map { it.value.toInt() }.toMutableList()
    // 统计与对比多重集
    val need = cards.groupingBy { it }.eachCount().toMutableMap()
    val have = used.groupingBy { it }.eachCount()
    // 每张牌最多用一次
    for ((k, cnt) in have) {
        val allow = need[k] ?: 0
        if (cnt > allow) return false
        need[k] = allow - cnt
    }
    // 必须全部用完
    return need.values.all { it == 0 }
}

/** 将表达式转为RPN并计算（支持 + - × ÷ 和括号） */
fun evaluateExprToFraction(expr: String): Fraction? {
    // 1) 词法
    data class Tok(val t: String)
    val tokens = mutableListOf<Tok>()
    var i = 0
    while (i < expr.length) {
        val c = expr[i]
        when {
            c.isWhitespace() -> i++
            c in listOf('(', ')', '+', '-', '×', '÷') -> {
                tokens += Tok(c.toString()); i++
            }
            c.isDigit() -> {
                // 两位数处理
                var j = i + 1
                while (j < expr.length && expr[j].isDigit()) j++
                tokens += Tok(expr.substring(i, j))
                i = j
            }
            else -> return null // 非法字符
        }
    }

    // 2) Shunting-yard to RPN
    fun prec(op: String) = when (op) { "+","-" -> 1; "×","÷" -> 2; else -> 0 }
    val output = mutableListOf<Tok>()
    val stack = ArrayDeque<Tok>()
    for (t in tokens) {
        when {
            t.t.first().isDigit() -> output += t
            t.t == "(" -> stack.addLast(t)
            t.t == ")" -> {
                while (stack.isNotEmpty() && stack.last().t != "(") {
                    output += stack.removeLast()
                }
                if (stack.isEmpty() || stack.last().t != "(") return null
                stack.removeLast()
            }
            t.t in listOf("+","-","×","÷") -> {
                while (stack.isNotEmpty()) {
                    val top = stack.last().t
                    if (top in listOf("+","-","×","÷") && prec(top) >= prec(t.t)) {
                        output += stack.removeLast()
                    } else break
                }
                stack.addLast(t)
            }
            else -> return null
        }
    }
    while (stack.isNotEmpty()) {
        val op = stack.removeLast()
        if (op.t == "(") return null
        output += op
    }

    // 3) 计算RPN
    val st = ArrayDeque<Fraction>()
    for (t in output) {
        if (t.t.first().isDigit()) {
            st.addLast(Fraction.fromInt(t.t.toInt()))
        } else {
            if (st.size < 2) return null
            val b = st.removeLast()
            val a = st.removeLast()
            val r = when (t.t) {
                "+" -> a + b
                "-" -> a - b
                "×" -> a * b
                "÷" -> if (b.n == 0L) return null else a / b
                else -> return null
            }
            st.addLast(r)
        }
    }
    return if (st.size == 1) st.last() else null
}

/** --------- UI --------- **/

@Composable
fun TwentyFourGameScreen() {
    var cards by remember { mutableStateOf(listOf(1, 5, 5, 5)) }
    var solution by remember { mutableStateOf<String?>(null) }
    var expr by remember { mutableStateOf("") }
    var feedback by remember { mutableStateOf("") }
    var usedCount by remember { mutableStateOf(mutableMapOf<Int, Int>()) }

    fun refresh() {
        val (nums, sol) = generateSolvable()
        cards = nums
        solution = sol
        expr = ""
        feedback = "出题完成：请用四张牌和 + - × ÷ ( ) 算出 24。"
        usedCount = mutableMapOf()
    }

    LaunchedEffect(Unit) {
        refresh()
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            "24 点小游戏",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        // 牌面
        CardRow(
            title = "本局四张牌（每张最多用一次）",
            items = cards.map { it.toString() },
            highlightCounts = usedCount
        ) { v ->
            // 点击数字拼到表达式，且统计使用次数（仅提示，真正校验以 validate 为准）
            expr += v
            val key = v.toInt()
            usedCount[key] = (usedCount[key] ?: 0) + 1
        }

        // 操作区
        OperatorPanel(
            onAdd = { expr += "+" },
            onSub = { expr += "-" },
            onMul = { expr += "×" },
            onDiv = { expr += "÷" },
            onL = { expr += "(" },
            onR = { expr += ")" },
            onBack = {
                // 简单回退一个字符，并尝试回退统计
                if (expr.isNotEmpty()) {
                    // 尝试是否删的是两位数字
                    val lastTwo = if (expr.length >= 2) expr.takeLast(2) else ""
                    val lastOne = expr.takeLast(1)
                    when {
                        lastTwo in listOf("10", "11", "12", "13") -> {
                            expr = expr.dropLast(2)
                            val k = lastTwo.toInt()
                            usedCount[k] = ((usedCount[k] ?: 0) - 1).coerceAtLeast(0)
                        }
                        lastOne.first().isDigit() -> {
                            expr = expr.dropLast(1)
                            val k = lastOne.toInt()
                            usedCount[k] = ((usedCount[k] ?: 0) - 1).coerceAtLeast(0)
                        }
                        else -> expr = expr.dropLast(1)
                    }
                }
            },
            onClear = {
                expr = ""
                usedCount = mutableMapOf()
            }
        )

        // 当前表达式显示
        OutlinedTextField(
            value = expr,
            onValueChange = { new ->
                // 也允许手动输入；为简单起见不过滤，判定时严格校验
                expr = new
                // 实时刷新“已用计数”属于增强功能，这里保持简单
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("你的表达式（可手输或点按钮）") },
            singleLine = false,
            maxLines = 3
        )

        // 按钮行
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(onClick = {
                // 判定
                val okUse = validateUsesAllCards(expr, cards)
                if (!okUse) {
                    feedback = "❌ 表达式未正确使用四张牌（每张各一次）或包含不允许的内容。"
                    return@Button
                }
                val v = evaluateExprToFraction(expr)
                feedback = if (v != null && v.equalsInt(24)) {
                    "✅ 正确！恭喜你算出 24！"
                } else {
                    "❌ 结果不是 24，请再试试～"
                }
            }) { Text("判定是否=24") }

            OutlinedButton(onClick = {
                refresh()
            }) { Text("换一题（必有解）") }

            OutlinedButton(onClick = {
                solution?.let { feedback = "提示：$it" } ?: run { feedback = "暂无提示" }
            }) { Text("查看提示/答案") }
        }

        Text(
            feedback,
            fontSize = 16.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
        )
    }
}

@Composable
fun CardRow(
    title: String,
    items: List<String>,
    highlightCounts: Map<Int, Int>,
    onItemClick: (String) -> Unit
) {
    Column(Modifier.fillMaxWidth()) {
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(8.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(items.size) { idx ->
                val t = items[idx]
                val count = highlightCounts[t.toInt()] ?: 0
                Box(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(
                            width = 2.dp,
                            color = if (count > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                            shape = RoundedCornerShape(12.dp)
                        )
                        .clickable { onItemClick(t) }
                        .padding(vertical = 18.dp, horizontal = 22.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = t,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (count > 0) {
                            Text(
                                text = "已用 $count 次",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun OperatorPanel(
    onAdd: () -> Unit,
    onSub: () -> Unit,
    onMul: () -> Unit,
    onDiv: () -> Unit,
    onL: () -> Unit,
    onR: () -> Unit,
    onBack: () -> Unit,
    onClear: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OpButton("+", onAdd)
            OpButton("-", onSub)
            OpButton("×", onMul)
            OpButton("÷", onDiv)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OpButton("(", onL)
            OpButton(")", onR)
            OutlinedButton(onClick = onBack) { Text("退格") }
            OutlinedButton(onClick = onClear) { Text("清空") }
        }
    }
}

@Composable
fun OpButton(symbol: String, onClick: () -> Unit) {
    Button(onClick = onClick) {
        Text(symbol, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
    }
}
