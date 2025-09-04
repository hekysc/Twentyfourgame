Uni-App 移植版（HBuilderX）

- 项目路径：`uni-app/`
- 入口页面：`uni-app/pages/index/index.vue`
- 启动文件：`uni-app/main.js`
- 路由配置：`uni-app/pages.json`
- 应用配置：`uni-app/manifest.json`

使用步骤（在 HBuilderX 中）：

1. 文件 -> 打开目录 -> 选择本仓库内的 `uni-app/` 文件夹
2. 运行 -> 运行到浏览器（H5）或 运行到手机/模拟器
3. 若需打包 App，配置 `manifest.json` 中的应用信息后，使用 HBuilderX 进行云打包

说明：

- 游戏规则与原生 Android 版一致，表达式只允许 `+ - × ÷ ( )` 与数字 `1..13`
- 使用分数运算（有理数）避免浮点误差，确保 24 的判定精准
- “换一题（必有解）” 会随机生成一组可解的数字并给出一个参考答案

