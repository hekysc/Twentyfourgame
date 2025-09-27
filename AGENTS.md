# 项目协作约定（AGENTS 指南）

本文件为在本仓库中协作的智能体/开发者提供约定与提示。请在对代码进行任何修改前通读本文件。其约束作用域为仓库根目录及其子目录。

可以从work_continue.md的找到下一个任务，完成后加入到日志文件中。

## 概览

- 技术栈：Uni-App + Vue 3（`<script setup>` 组合式 API）
- 目标平台：H5 与 App（HBuilderX 调试与打包）
- 项目定位：24 点小程序，支持拖拽组表达式、判定结果、记录用户与统计数据。
- 核心目录结构：
  - `App.vue` / `main.js`：应用入口
  - `pages/`：页面模块
    - `pages/login/index.vue`：登录/选择玩家
    - `pages/index/index.vue`：程序主界面（拖拽牌与运算符、校验、提示、换题）
    - `pages/user/index.vue`：用户管理（增删改、切换当前用户）
    - `pages/stats/index.vue`：统计总览（按用户汇总）
  - `utils/`：通用逻辑
    - `utils/solver.js`：24 点求解与表达式计算（分数精度，避免浮点误差）
    - `utils/store.js`：本地存储封装（用户与统计）
  - `components/PlayingCard.vue`：扑克牌渲染组件（纯样式绘制）
  - `pages.json`：页面与 TabBar 配置
  - `manifest.json`：应用配置（App 打包信息）
  - `unpackage/`：构建输出（请勿手工修改）

## 运行与构建

- 推荐使用 HBuilderX：
  1) “文件”→“打开目录” 选择仓库根目录
  2) “运行”→ 选择“运行到浏览器（H5）/ 运行到手机模拟器”
  3) 发布 App：完善 `manifest.json`，使用 HBuilderX 打包
- H5 运行时无需额外 Node 依赖（Uni-App 工程由 HBuilderX 驱动）。

## 代码风格与约定

- 组件风格：统一使用 Vue 3 `<script setup>` 与组合式 API。
- 文件命名：页面文件位于 `pages/<name>/index.vue`，通用逻辑位于 `utils/*.js`。
- 表达式字符：请使用 `×`、`÷`（Unicode）而非 `*`、`/`。`utils/solver.js` 与 UI 已以此为准。
- 拖拽与表达式：
  - 程序区通过 `tokens`（数组）维护表达式序列，元素形如 `{ type: 'num'|'op'|'tok', value, ... }`。
  - 牌使用 `{ rank: 1..13, suit: 'S'|'H'|'D'|'C' }`，`usedByCard` 数组记录是否被使用。
  - 双击快捷：数字/运算符插入末尾，`tok`（已在表达式中的 token）双击删除。
  - 表达式区根据容器宽度自动缩放（`updateExprScale`）。
- 面牌规则切换：`J/Q/K` 可按两种模式映射（`faceUseHigh`）：
  - 低位：`J/Q/K = 1`
  - 高位：`J=11 / Q=12 / K=13`
  - 相关逻辑位于 `pages/index/index.vue` 与 `components/PlayingCard.vue`：`evalRank`、`labelFor` 以及组件内的渲染样式。
- 资源规范：扑克牌图案由 `PlayingCard` 组件绘制，无需静态图片。
- UI 单位：以 `rpx` 为主，注意小程序/H5/App 端兼容性。

## 核心逻辑说明

- `utils/solver.js`
  - `Fraction`：分数运算，`plus`/`minus`/`times`/`div`，`toString` 友好输出，`equalsInt` 判断是否为整数值（用于 24）。
  - `evaluateExprToFraction(expr)`：
    - 词法拆分：数字、括号与 `+ - × ÷`
    - Shunting-yard 转 RPN，再以分数计算，避免浮点误差与除零。
  - `solve24(nums: number[4])`：DFS 枚举 `+ - × ÷` 与括号位置，返回可行表达式或 `null`。
  - `generateSolvable()`：随机生成一手有解的四个数及其表达式（未直接在页面使用）。
- `pages/index/index.vue`
  - 牌堆生成：52 张牌洗牌，按需随机抽取四张，调用 `solve24` 验证“可解”后出题。
  - 表达式编辑：拖拽/插入/移动/删除，由占位与最近插入动画辅助（`insert-placeholder`、`just-inserted`）。
  - 校验/记录：
    - `check()` 使用 `evaluateExprToFraction` 计算，判定是否等于 24。
    - 结果通过 `utils/store.pushRound(ok)` 记录，并更新“本局统计”。
  - 结束逻辑：牌库不足或无可解题时弹窗，选择“下一局”或跳转“统计”。
- `utils/store.js`
  - 存储键：`tf24_users_v1`、`tf24_stats_v1`
  - 用户：`ensureInit()`、`getUsers()`、`addUser()`、`switchUser()`、`renameUser()`、`removeUser()`、`setUserAvatar()`、`setUserColor()`、`getCurrentUser()`、`touchLastPlayed()`
  - 统计：`pushRound(success)`、`readStats(uid)`、`allUsersWithStats()`
  - 复位：`resetAllData()`（清空本地存储后重新初始化）

## 页面与路由

- `pages.json` 已定义页面与 TabBar：`统计`（`/pages/stats/index`）、`程序`（`/pages/index/index`）、`用户`（`/pages/user/index`）。
- 常用导航封装：
  - Tab 切换优先 `uni.switchTab({ url })`
  - 页面跳转回退选用 `uni.navigateTo` / `uni.reLaunch`
- 若调整 TabBar 图标，请在 `static/icons/` 下放置资源，并在 `pages.json` 中配置 `iconPath`/`selectedIconPath`。

## 修改建议与注意事项

- 不要手工修改 `unpackage/`（构建产物）；该目录应由构建流程生成。
- 若扩展运算符/语法：需同步修改
  - UI：运算符按钮集合与 Token 渲染（`pages/index/index.vue`）
  - 解析：`utils/solver.js` 的词法、优先级与 RPN 计算
- 保持 `×`、`÷` 字符的一致性（输入/显示/计算均依赖该字符）。
- 变更 `utils/store.js` 的数据结构时，先补充迁移逻辑，避免破坏已有本地数据。
- 尽量避免一次性重构多个模块；在 PR 中聚焦单一改动面，并附带简短说明。

## 提交与验证

- 编辑前阅读本文件与 `README.md`。
- 修改后优先在 H5 端自测：
  - 登录/创建玩家 → 进入“程序” → 拖拽组成表达式 → 校验“24” → 查看统计是否更新。
  - 测试两种面牌规则（`J/Q/K=1` 与 `11/12/13`）。
- 如新增/调整资源，请确保在多端（H5/App）显示与路径大小写一致。

## 常见问题（给智能体的提示）

- 中文字符编码：仓库包含中文文本与 Unicode 运算符，保持 UTF-8 保存；不要替换为 ASCII 符号。
- 选择器/布局：表达式区宽度变化后需调用 `updateExprScale()` 与 `recomputeExprHeight()`，避免换行或溢出。
- 牌面与值：`labelFor(n)` 用于显示（A/J/Q/K），`evalRank(rank)` 与 `faceUseHigh` 用于计算映射（表达式计算使用映射值）。
- 本地存储：如出现异常（格式损坏），`login` 页提供“重置数据”按钮（调用 `resetAllData()`）。

---

如需在子目录内制定更细的协作规范，可在相应目录新增 `AGENTS.md`；更深层级的规范优先生效。本文件将在存在冲突时被更深层级的 `AGENTS.md` 覆盖。

