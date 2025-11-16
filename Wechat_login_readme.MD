# 登录模块工作原理说明

本文聚焦仓库 `pages/login/index.vue` 及其依赖的 `utils/auth.js`、`utils/cloud-store.js` 与 uniCloud 云函数，梳理登录流程、数据流向与调试要点，方便维护者快速上手或排查问题。

## 1. 模块组成与职责

| 模块 | 作用 | 关键点 |
| --- | --- | --- |
| `pages/login/index.vue` | 登录页面 UI 与交互 | 负责平台检测、按钮交互、提示、退出与数据迁移弹窗 |
| `utils/auth.js` | 本地会话与登录手势封装 | 持久化 `token + user`，封装 `wxLogin`、`appLogin`、`getWxProfileAndUpdate`、`ensureAutoLogin` |
| `utils/cloud-store.js` | 云端业务数据访问层 | 通过 `callFunction` 调用 `user`/`game` 云函数，做用户缓存和统计缓存 |
| `uniCloud-aliyun/cloudfunctions/login` | 后端认证 | 根据 `scene`（`mp-weixin`/`app`）校验身份、落库并返回 token |
| `uniCloud-aliyun/cloudfunctions/user` | 用户资料维护 | 根据 token 拉取/更新用户资料 |
| 辅助模块 | `useFloatingHint`、`useEdgeExit`、`useSafeArea`、`components/AppNavBar` | 负责提示蒙层、边缘返回、沉浸式布局等体验细节 |

## 2. 页面层逻辑（`pages/login/index.vue`）

### 2.1 状态与布局

- `currentUser`：当前登录用户，来源于 `loadCurrentUser()` → `cloud-store.getCurrentUser()`。
- `loginLoading`：防止重复触发登录，登录按钮将进入 Loading 状态。
- `showMigrationPrompt`：检测本地旧版存档后显示“数据迁移”卡片。
- `userColor`：用户头像占位背景，使用 `generateUserColor()` 或云端 `settings.color`。
- `isMpWeixin`/`isApp`：通过条件编译判断平台，决定显示哪种登录按钮及行为。
- `loginPageStyle`：结合 `useSafeArea()` 为顶部状态栏留白；`updateVHVar()` 处理 H5 `100vh` 在刘海屏的兼容问题。

### 2.2 生命周期钩子

- `onMounted`：顺序执行 `ensureInit()` → `loadCurrentUser()` → `checkForMigration()`，并注册 `uni.onWindowResize` 更新 `--vh` 变量。
- `onBackPress`：实现“2 秒内连续返回退出 App”逻辑，借助 `useFloatingHint()` 给出提示，最终通过 `exitLoginPage()` 调 `exitApp()`。
- `onShareAppMessage` / `onShareTimeline`：提供页面级分享文案。

### 2.3 UI 与交互

- 登录按钮：根据平台显示“微信快捷登录”“设备登录”或“游客体验”（仅提示受限）。
- 登录成功后展示“当前用户卡片”与“开始游戏/退出登录”按钮。
- “编辑”按钮触发 `editProfile()`，内部进一步调用 `editNickname()`、`editAvatar()` 完成资料修改并更新云端。
- `floating-hint-layer` 用于跨端统一提示，配合 `hintState` 控制交互性（可点击关闭）或纯提示。
- `useEdgeExit` 绑定 `@touchstart/move/end`，用于捕获从屏幕边缘的退出手势，移动端体验更自然。

## 3. 登录流程拆解

### 3.1 微信小程序登录

1. 用户点击“微信快捷登录”→ `handleWxLogin()` 检查 `loginLoading`，防止多次提交。
2. `wxLogin()`（`utils/auth.js`）内部调用 `uni.login({ provider: 'weixin' })` 拿到 `code`，并将 `scene='mp-weixin'`、`code`、`platform` 传给 `uniCloud.callFunction('login')`。
3. 云函数 `login`：
   - `handleMpWeixin()` 调用微信 `jscode2session` 接口，校验 AppID/Secret。
   - 根据 `openid` 查/建用户，更新 `platforms` 与 `last_login_at`。
   - `auth.createToken(user)` 返回 `token + user`。
4. 前端将云端返回值写入本地存储（`saveSession()`），展示提示后调用 `loadCurrentUser()`。
5. 如运行在微信平台，再调用 `getWxProfileAndUpdate()` 获取授权昵称、头像并同步到 `user` 云函数，随后再次刷新 `currentUser`。
6. 登录完成 1 秒后触发 `goToGame()`，使用 `uni.reLaunch` 切至 `/pages/index/index`。

### 3.2 App 端登录

1. `handleAppLogin()` 调用 `appLogin()`。
2. `appLogin()` 仅在 `APP-PLUS` 可用，利用 `plus.device.uuid/imei` 生成 `deviceId`，调用 `uniCloud.callFunction('login')` 并走 `handleApp()` 分支。
3. 云端根据 `device_id`（或手机号）查找/创建用户，返回 token。
4. 页面刷新用户并跳转游戏，整体逻辑与微信分支一致。

### 3.3 游客模式

`handleGuestLogin()` 仅弹出提示，提醒功能受限；并未建立实际会话，防止误解“游客模式”具备完整功能。

### 3.4 自动登录与退出

- `App.vue` 在 `onLaunch()` 中调用 `ensureAutoLogin()`，尝试使用已缓存 token 直接复用；若无 token，会在对应平台自动走一次 `wxLogin()`/`appLogin()`（静默失败会被捕获并忽略）。
- `ensureInit()` 会在无 token 时清理缓存，避免拿到过期的用户/统计数据。
- `logout()` 通过 `clearSession()` 删除 token & user，本地状态 `currentUser` 清空，并提示“已退出登录”。
- `exitLoginPage()` 调用 `exitApp()`；若运行在浏览器等不支持直接退出的环境，会回退或跳转到主页面作为兜底。

## 4. 用户资料与缓存（`utils/cloud-store.js`）

1. **会话同步**：`getCurrentUser()` 优先读取 `saveSession()` 中的用户，若存在 token 则调用 `callUserFunction('getProfile')` 更新资料，并把结果缓存到 `CACHE_USER_KEY`（5 分钟有效）。
2. **资料更新**：`updateUserProfile()` 统一封装 `callUserFunction('updateProfile')`，页面的改名、换头像都走这套逻辑，成功后刷新 session 和缓存。
3. **个性化颜色**：若云端 `settings.color` 缺失，前端使用 `generateUserColor()` 随机选取柔和色块作为默认头像背景。
4. **本地缓存治理**：`ensureInit()` 与 `resetAllData()` 会根据 token 状态清理 `CACHE_USER_KEY` / `CACHE_STATS_KEY`，避免脏数据。
5. **统计接口**：虽然登录页不直接使用，但 `pushRound()`、`readStats()` 等函数会在游戏/统计页透过 token 调 `game` 云函数；登录保证 token 有效，是后续统计链路的前提。

## 5. 数据迁移与辅助提示

- `checkForMigration()`：若检测到旧版本地 `tf24_users_v1` 存储且当前已有云端用户，则提示“数据迁移”卡片。
- `performMigration()` 调用 `cloud-store.migrateLocalData()`（底层 `game` 云函数 `markMigrationComplete`）标记迁移完成，再给出结果提示；`skipMigration()` 用于用户拒绝迁移。
- `hintState` + `floating-hint-layer`：统一的提示通道，既能展示短 Toast，也能在 `useEdgeExit` 触发时提示“再按一次返回退出应用”，保证跨端一致性。

## 6. 云函数协同

### 6.1 `login` 云函数

- `scene='mp-weixin'`：使用 `WX_APPID/WX_SECRET` 调微信 `jscode2session`，以 `openid` 为主键建用户，记录平台数组、防止重复创建。
- `scene='app'`：依赖 `device_id` 或手机号，补齐昵称/头像等字段，支持多平台统计。
- 返回值始终包含 token（`auth.createToken(user)`）与 `user` 对象，前端直接存储即可。

### 6.2 `user` 云函数

- 所有入口先解析 `token`（支持 `event.token` 或 Bearer Header），通过 `auth.verifyToken` 校验身份。
- `getProfile`：返回用户脱敏信息。
- `updateProfile`：可选更新昵称、头像、性别以及 `settings`（用于颜色等扩展配置）。
- `setPhone`：为 App 端绑定手机号留有扩展点。

### 6.3 `game` 云函数相关

- 登录页仅触发 `getMigrationStatus` / `markMigrationComplete` 这两个动作，确认历史本地数据是否已同步云端。
- 其他 API（`saveRecord`、`getStatsSummary` 等）由游戏/统计页面使用，但它们同样依赖登录页提供的有效 token。

## 7. 调试与常见问题

结合 `WECHAT_LOGIN_FIX.md` 中的经验，可按以下顺序排查：

1. **环境变量**：在 uniCloud 控制台为 `login` 云函数配置 `WX_APPID`、`WX_SECRET`，与微信公众平台一致。
2. **合法域名**：在微信开发者工具或公众平台后台关闭 URL 校验或补全合法域名，确保 `https://api.weixin.qq.com` 可访问。
3. **云函数部署**：修改后重新上传 `login` 与 `user` 云函数，查看日志（uniCloud 控制台 → 运行日志）定位异常。
4. **Network 调试**：在开发者工具 Network 面板确认 `login` 请求是否成功、响应体是否包含 token。
5. **前端提示**：`showHint()` 的文案会在多处抛出（如 “登录失败，请重试”“头像上传失败”），根据不同提示快速定位客户端问题。

## 8. 典型时序概览

```
用户点击微信登录
    ↓ handleWxLogin() 置 loginLoading
    ↓ utils/auth.wxLogin() → uni.login() → 云函数 login.handleMpWeixin()
    ↓ 返回 token + user → saveSession()
    ↓ loadCurrentUser() → cloud-store.getCurrentUser() → user 云函数
    ↓ getWxProfileAndUpdate()（可选，同步微信昵称与头像）
    ↓ currentUser 渲染、提示成功
    ↓ goToGame() 重启到 pages/index/index
```

通过上述链路可以看到：前端负责调用链与体验，`utils/auth` 管理本地会话，`utils/cloud-store` 作为 RPC 封装层，云函数承担真正的身份校验与数据落库。理解这些节点即可快速定位登录问题或扩展其他登录场景（如手机号 / 第三方）。
