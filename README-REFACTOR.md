# Index 页重构说明

本次重构聚焦于将 `pages/index/index.vue` 中的计算逻辑下沉到独立模块，保持 UI 与交互行为完全一致。

## 模块拆分

- `utils/calc.js`
  - 通用纯函数集合：牌面映射（`mapCardRank`）、牌面展示（`labelForRank`、`cardImagePath`）、分数/表达式格式化（`formatFractionValue`、`formatExpressionWithValue`、`stripOuterParens`）、表达式统计与校验（`tokensToExpression`、`computeExprStats`、`isExpressionComplete`）及时间格式化等。
  - 这些函数均为无副作用的输入 → 输出，可以在任意环境单测。文件末尾附带简易调用示例。
- `core/basic-mode.js`
  - Basic 模式相关状态与运算引擎：`createBasicState` 生成初始槽位，`combineBasicSlots` 完成两槽四则运算并返回新状态/统计结果，`undoBasicHistory` 负责撤销。
  - 页面事件仅需收集索引与运算符，调用后根据返回结构更新视图或执行 `settleHandResult`。
- `core/game-engine.js`
  - 牌局推进逻辑：`drawSolvableHand` 从牌堆中挑选可解手牌并返回更新后的牌堆，`newDeck` 生成洗好的牌组。
  - 页面根据返回状态决定是否弹窗提示或进入下一手。

## 页面层调整

- 页面不再直接包含纯算法：表达式求值、分数运算、手牌选择等均通过上述模块调用实现。
- 事件处理函数聚焦于参数准备、结果分发与 UI 状态更新。例如 `applyBasicCombination` 只负责调用 `combineBasicSlots`，随后根据返回的 `isSolved`、`exprForRecord` 决定提示或结算。
- 保留必要的 `uni.showModal`、`pushRound` 等平台 API 调用，同时以逻辑层返回的状态驱动是否执行。

## 关键函数调用关系

- `nextHand()` → `drawSolvableHand()` 取得新手牌 → 更新 `deck/cards/solution` → `resetHandStateForNext()`。
- Basic 模式：
  - 选牌 → `applyBasicCombination()` → `combineBasicSlots()` → 若 `isSolved` 调用 `settleHandResult()`。
  - 撤销 → `undoBasicStep()` → `undoBasicHistory()`。
- Pro 模式提交：`check()` 调用 `isExpressionComplete()`、`evaluateExprToFraction()`、`computeExprStats()` → `settleHandResult()`。

## 仍保留在页面的逻辑

- 平台 API 交互（`uni.showModal`、`pushRound`、`uni.navigateTo` 等）。
- 基于 UI 的拖拽、拖放插入位置计算、反馈文案设置等无法脱离页面上下文的逻辑。

## 自测

- 手动验证流程：切换 Basic/Pro 模式 → 拖拽/组合表达式 → 提交/撤销/提示/跳题 → 切换面牌模式，行为与改动前保持一致。
- 抽离出的函数均为纯函数，可通过 Node REPL 或引入到单测脚本中调用。示例：

```js
import { combineBasicSlots, createBasicState } from './core/basic-mode.js'

const state = createBasicState(
  [ { rank: 1, suit: 'S' }, { rank: 3, suit: 'H' }, { rank: 5, suit: 'D' }, { rank: 7, suit: 'C' } ],
  false
)
const result = combineBasicSlots({ ...state, slots: state.slots, history: [] }, 0, 1, '+')
console.log(result.ok, result.data.expression) // true, (1+3)
```

如后续需要自动化测试，可直接对上述纯函数编写单元测试。
