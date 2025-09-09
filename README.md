Uni-App 项目（HBuilderX）
- 项目路径：仓库根目录
- 入口页面：`pages/login/index.vue`
- 启动文件：`main.js`
- 路由配置：`pages.json`
- 应用配置：`manifest.json`

运行与打包（HBuilderX）
1. 文件 -> 打开目录 -> 选择本仓库根目录
2. 运行 -> 运行到浏览器（H5）或 运行到手机模拟器
3. 若需打包 App，先在 `manifest.json` 配置应用信息，然后使用 HBuilderX 进行云打包

功能说明
- 24 点规则：仅允许 `+ - × ÷ ( )` 与数字 `1..13`
- 采用分数（有理数）运算避免浮点误差，判定结果更精确
- 支持“换一题（必有解）”：随机生成可解数字并提供参考答案

底部导航更新（重要）
- 已将页面内的“底部导航”改为全局 TabBar（`pages.json` -> `tabBar`）
- Tab：统计 / 游戏 / 用户；选中为彩色（`selectedColor`），未选中为灰色（`color`）
- 如需更换为带图标的 Tab，请在 `tabBar.list` 的每个项中补充 `iconPath` 与 `selectedIconPath`
  - 建议将图标放在 `static/icons/` 目录下（示例：`/static/icons/stats.png`、`/static/icons/stats-active.png`）

目录备注
- 根目录为当前工程使用目录；`uni-app/` 下如有历史副本已废弃，请以根目录文件为准
