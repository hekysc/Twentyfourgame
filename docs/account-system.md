# 账号体系与登录改造说明

## 账号类型

| 账号类型 | 唯一标识 | 特性 |
| --- | --- | --- |
| 微信账号 (`weixin`) | `openid` + 可选 `unionid` | 可跨设备登录，支持在任意微信小程序实例同步数据 |
| 本机普通账号 (`local`) | `_id` + `device_id` | 可在同一设备创建多个，禁止跨设备登录，可随时升级为微信账号 |

`user` 集合字段：

```jsonc
{
  "_id": "string",          // user_id
  "account_type": "weixin | local",
  "openid": "string",
  "unionid": "string",
  "device_id": "string",
  "nickname": "string",
  "avatar_url": "string",
  "platforms": ["mp-weixin", "app-android", "app-ios", "app-harmony"],
  "created_at": 0,
  "last_login_at": 0,
  "stats": { "score": 0, "coins": 0 },
  "merged_to": "string"
}
```

## 云函数 `login`

- `scene = 'mp-weixin'`：接收 `code`，走 `jscode2session`，按 `openid` 查找/创建账号。
- `scene = 'app'`：带 `deviceId` + `user_id` 登录普通账号；当 `create = true` 时创建新账号并绑定设备（保持所有注册/登录分支在同一云函数内，便于复用 token 逻辑）。
- `scene = 'upgrade'`：普通账号 + `code` 升级/合并为微信账号。
- 所有场景返回 `{ token, user }`，token 由 `common/auth` 生成，user 已去除敏感字段并且 `errCode/errMsg` 结构化返回错误，方便前端识别。

## 配置 / WX_APPID · WX_SECRET

- `login/index.js` 先读取 `process.env.WX_APPID/WX_SECRET`，若未提供会自动回退到 `uni-config-center`（例如 `config/uni-id` 中的 `mp-weixin` 节点）。
- 推荐在 `uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json`（示例）或云函数环境变量中配置密钥；调试期可在云函数测试面板临时写死。
- 如果两者都未配置，将在 `fetchWeixinSession` 阶段抛出“请在环境变量或 uni-config-center 中配置”提示，避免上线后因为遗漏导致静默失败。

## device_id 与本机账号

- `utils/local-account.ensureDeviceId()` 在 App 端优先使用 `plus.device.uuid`，小程序端生成一个本地 UUID 并持久化到 `uni.setStorageSync('tf24_device_id_v1')`。
- 清理小程序缓存会丢失该 device_id，相当于普通账号无法再登录。PRD 允许这种行为（提示用户升级为微信账号以跨设备/恢复）。
- 本机普通账号创建信息也缓存在 `local_accounts`，支持多账号但都受同一个 `device_id` 限制。

## 普通账号删除策略

- 列表页长按仅移除本地缓存（方案 A），云端记录保留以便后续升级或手动恢复。
- 如需联动删除，可新增二次确认入口调用新的云函数；目前默认策略更安全、可避免误删导致云端数据不可追溯。

调试时可在 HBuilderX → 运行配置中设置 `WX_APPID`、`WX_SECRET` 环境变量，或在云函数的环境变量界面临时写死测试值。

## 前端页面与流程

1. **登录方式选择（`pages/login/index`）**：提供“微信登录”“普通账号”入口。
2. **普通账号列表（`pages/local-account/list`）**：读取 `local_accounts`，可选择登录/长按删除。
3. **普通账号创建（`pages/local-account/create`）**：输入昵称、可选头像，调用 `login(scene='app', create:true)` 创建账号。
4. **升级入口（`pages/user/index`）**：普通账号在微信端可触发 `scene='upgrade'`，升级后即可跨设备登录。

`utils/local-account.js` 统一管理 `device_id` 和本机账号缓存，`utils/auth.js` 封装云函数调用、token 存储与平台判定。

## manifest / 小程序后台配置

- manifest.json：保持 `uniCloud` 服务空间绑定，并为 mp-weixin 勾选“微信登录”权限。
- 微信小程序后台：在“开发管理→开发设置”中将 `request` 白名单加入 `https://api.weixin.qq.com`，并配置服务器域名。
- App 打包：在 `manifest.json` → `App模块配置` 中启用 `uniCloud`、`uni.login` 所需模块。

## WX_APPID / WX_SECRET

- 本地调试可在 `uniCloud` 云函数测试面板、`uniCloud/cloudfunctions/login/index.js` 中通过 `process.env.WX_APPID`、`process.env.WX_SECRET` 读取。
- 临时测试可在 `uniCloud` 控制台 → `环境变量` 中添加 `WX_APPID` / `WX_SECRET`。
- 请勿将真实密钥提交至仓库。
