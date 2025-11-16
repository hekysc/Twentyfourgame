# uniCloud 多账号体系与登录改造说明

本文记录当前仓库中“微信账号 + 本机普通账号”双轨并行的账号体系、云函数实现与前端集成方式，便于后续扩展/联调。

## 1. 总体架构
- **前端（uni-app）**：所有端统一使用 `utils/auth.js`、`utils/local-account.js` 维护 token、设备 ID 及本机普通账号缓存；页面通过条件编译接入不同的登录流程。
- **后端（uniCloud 云函数 + 云数据库）**：`login` 云函数提供三种 `scene`：`mp-weixin`、`app`（普通账号）与 `upgrade`（普通账号升级为微信账号）；`common/auth.js` 输出 HMAC token；`user`/`game` 云函数在业务层复用 token 鉴权。
- **数据层**：统一 `user` 表，使用 `_id` 作为 `user_id`；通过 `account_type`（`weixin | local`）区分微信账号与普通账号，并保存 `device_id`、`openid` 等字段。

```
uni-app（mp-weixin / app-android / app-ios / app-harmony）
   │  utils/auth.js 负责调用登录云函数、缓存 token
   ▼
uniCloud/cloudfunctions
   ├─ common/auth.js         # createToken / verifyToken
   ├─ login/index.js         # scene=mp-weixin / app / upgrade
   ├─ user/index.js          # 资料修改、头像昵称同步
   └─ game/index.js          # 业务数据，需要先校验 token
```

## 2. 账号类型与能力
| 账号类型 | 唯一标识 | 支持平台 | 能力 | 关键字段 |
| --- | --- | --- | --- | --- |
| 微信账号 (`account_type = 'weixin'`) | `openid`（必填）+ `unionid`（可选） | mp-weixin + 任意安装了微信的 App | 跨设备登录、可同步昵称头像、可承载升级后的数据 | `_id`、`openid`、`platforms`、`stats` |
| 普通账号 (`account_type = 'local'`) | `_id`（云端生成）+ `device_id` | mp-weixin（无需 wx.login）与 App 端 | 本机多账号切换，禁止跨设备；可在任意端创建/登录，但必须上传当前 `device_id` | `_id`、`device_id`、`nickname`、`stats` |
| 升级账号 | 普通账号升级后即成为微信账号 | 与微信账号一致 | 普通账号的统计与进度合并到微信账号；原普通账号标记 `merged_to` | `merged_to`、`merged_at` |

> **升级流程**：在本机选定一个普通账号 → 小程序调用 `wx.login` → `login(scene='upgrade')` 校验 `device_id` + `user_id`，若该微信尚无账号则直接把普通账号转型；若已有微信账号，则调用 `mergeStats` 合并数据，并把普通账号标记为 `merged`。

## 3. `user` 集合 schema

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 即 `user_id`，云端生成，前端也以此做本地缓存键 |
| `account_type` | string | `weixin` / `local` |
| `openid` | string | 微信账号的 openid，普通账号为空 |
| `unionid` | string | 微信生态唯一标识，可为空 |
| `device_id` | string | 普通账号绑定的设备 ID（App 端取 `plus.device.uuid`，小程序端取随机 UUID） |
| `nickname` | string | 可重复；普通账号默认“普通账号” |
| `avatar_url` | string | 头像 URL，可为空 |
| `platforms` | array | 已登录过的平台列表（`mp-weixin`/`app-android`/...） |
| `stats.score` | number | 游戏分数（示例字段） |
| `stats.coins` | number | 虚拟币（示例字段） |
| `created_at` | long | 创建时间戳 |
| `last_login_at` | long | 最近登录时间 |
| `merged_to` | string | 被合并到的微信账号 `_id`，仅升级场景产生 |
| `merged_at` | long | 升级完成时间 |

`uniCloud/database/user.schema.json`（已更新）示例：
```json
{
  "bsonType": "object",
  "required": ["account_type", "nickname"],
  "properties": {
    "_id": { "bsonType": "string", "description": "user_id，全局唯一" },
    "account_type": { "enum": ["weixin", "local"], "description": "账号类型" },
    "openid": { "bsonType": "string" },
    "unionid": { "bsonType": "string" },
    "device_id": { "bsonType": "string", "description": "普通账号绑定的设备ID" },
    "nickname": { "bsonType": "string" },
    "avatar_url": { "bsonType": "string" },
    "gender": { "bsonType": "int" },
    "platforms": { "bsonType": "array", "items": { "bsonType": "string" } },
    "stats": {
      "bsonType": "object",
      "properties": {
        "score": { "bsonType": "int" },
        "coins": { "bsonType": "int" }
      }
    },
    "created_at": { "bsonType": "long" },
    "last_login_at": { "bsonType": "long" },
    "updated_at": { "bsonType": "long" },
    "merged_to": { "bsonType": "string" },
    "merged_at": { "bsonType": "long" }
  },
  "indexes": [
    { "name": "idx_openid", "unique": true, "fields": { "openid": 1 } },
    { "name": "idx_device", "fields": { "device_id": 1 } },
    { "name": "idx_account_type", "fields": { "account_type": 1 } }
  ]
}
```

## 4. 登录云函数 `uniCloud/cloudfunctions/login/index.js`
关键逻辑：
- `handleMpWeixin`：调用 `fetchWeixinSession` 获取 openid/unionid → 查找/创建 `account_type='weixin'` 的用户 → 更新 `platforms` + `last_login_at` → 返回 token。
- `handleApp`：
  - 带 `user_id`：校验 `account_type === 'local'` 且 `device_id` 一致；更新 `last_login_at`。
  - `extra.create=true`：创建一个新普通账号（云端生成 `_id`），写入本机 `device_id`，昵称/头像来自 `extra`。
- `handleUpgrade`：
  1. `wx.login` → `code` → openid；
  2. 根据 `user_id` 读取普通账号并校验 `device_id`；
  3. 若 openid 未注册 → 直接把该普通账号升级成微信账号；
  4. 若已有微信账号 → `mergeStats`（`score` 取最大、`coins` 累加），并把普通账号记录 `merged_to`。

文件中提供了 `ensurePlatforms`、`normalizeStats`、`mergeStats` 等工具函数，最终均通过 `auth.createToken(user)` 产出 token，返回 `{ token, user: sanitizeUser(user) }`。

> **调试 WX_APPID/WX_SECRET**：在 uniCloud 云函数配置环境变量或 `.env.local`（HBuilderX 云函数运行配置）中写死 `WX_APPID`、`WX_SECRET`，并在微信小程序后台把云函数域名加入合法域名。

## 5. 前端辅助模块
### 5.1 `utils/local-account.js`
封装了 `listLocalAccounts`、`upsertLocalAccount`、`removeLocalAccount`、`markAccountUpgraded` 等方法，统一把本机普通账号缓存到 `tf24_local_accounts_v1`：
```js
// 缓存结构（local storage）
[
  { user_id, nickname, avatar_url, created_at, last_login_at, upgraded }
]
```

### 5.2 `utils/auth.js`
新增方法：
- `getDeviceId()`：App 端优先取 `plus.device.uuid`，否则生成随机 UUID 并落地 `tf24_device_id`。
- `wxLogin()`：小程序端 `wx.login` → `login(scene='mp-weixin')`。
- `createLocalAccount({ nickname, avatar_url })`：`login(scene='app', extra.create=true)`，创建普通账号并写入本地缓存。
- `loginLocalAccount(userId)` / `appLogin(userId)`：携带 `deviceId` 登录已存在的普通账号。
- `upgradeLocalAccount(userId)`：小程序端发起升级，成功后在本地标记 `upgraded` 并刷新 token。
- `getLocalAccounts()`：返回 `local_accounts` 列表供普通账号列表页展示。

> `ensureAutoLogin()` 仅在存在本地 token 时复用 Session，不再自动帮用户决定登录方式，避免误触发微信登录或错误的普通账号绑定。

## 6. 页面改造建议
### 6.1 登录方式选择页（`pages/login/index.vue` 可复用）
```vue
<template>
  <view class="login-choice">
    <button class="wx" @tap="doWxLogin" v-if="isMpWeixin">微信登录</button>
    <button class="local" @tap="goLocalList">普通账号登录</button>
  </view>
</template>
<script setup>
import { wxLogin } from '@/utils/auth.js'
const isMpWeixin = process.env.UNI_PLATFORM === 'mp-weixin'
async function doWxLogin() {
  try {
    await wxLogin()
    uni.reLaunch({ url: '/pages/index/index' })
  } catch (err) {
    uni.showToast({ title: err.message || '登录失败', icon: 'none' })
  }
}
function goLocalList() { uni.navigateTo({ url: '/pages/login/local-list' }) }
</script>
```

### 6.2 普通账号列表页
- 进入页面时 `const accounts = getLocalAccounts()`。
- 渲染 `accounts`（昵称、最近登录时间），并提供“新建普通账号”按钮。
- 点击某个账号：
  ```js
  import { loginLocalAccount } from '@/utils/auth.js'
  async function useAccount(item) {
    await loginLocalAccount(item.user_id)
    uni.reLaunch({ url: '/pages/index/index' })
  }
  ```
- 长按弹出菜单：编辑昵称（直接更新缓存 + 云端 `user`）、删除（`removeLocalAccountCache` + 调用后端删除接口，若暂未实现可 TODO）。

### 6.3 普通账号创建页
- 表单：昵称输入 + 头像选择。
- 提交：
  ```js
  import { createLocalAccount, getDeviceId } from '@/utils/auth.js'
  async function submit() {
    const nickname = form.nickname.trim() || '普通账号'
    const avatar = form.avatar_url
    await createLocalAccount({ nickname, avatar_url: avatar })
    uni.reLaunch({ url: '/pages/index/index' })
  }
  ```
- 创建成功后 `utils/local-account.js` 已缓存 `{ user_id, nickname, avatar_url }`，列表页直接可见。

### 6.4 升级为微信账号页
- 仅当当前登录态 `user.account_type === 'local'` 时展示“升级”按钮。
- 点击触发：
  ```js
  import { upgradeLocalAccount } from '@/utils/auth.js'
  async function upgrade(userId) {
    try {
      await upgradeLocalAccount(userId)
      uni.showToast({ title: '升级成功' })
      uni.reLaunch({ url: '/pages/index/index' })
    } catch (err) {
      uni.showModal({ title: '升级失败', content: err.message || '请稍后重试' })
    }
  }
  ```
- 成功后，前端可把该普通账号从本地列表中移除或标记“已升级（不可再登录）”。

## 7. manifest 与后台配置
1. **小程序后台**：
   - 在“开发管理 → 开发设置”添加云函数 HTTP 域名；
   - 配置合法 request 域名 `https://api.weixin.qq.com`（用于 `jscode2session`）。
2. **云函数环境变量**：
   - `WX_APPID`、`WX_SECRET` 写入 uniCloud 控制台或 HBuilderX 云函数运行配置。
   - `UNICLOUD_TOKEN_SECRET`（可选）用于 `common/auth.js` 的 HMAC 秘钥。
3. **manifest.json**：
   - 勾选 `mp-weixin` 登录、用户信息权限；
   - App 端在 `App权限-设备` 中启用“获取设备信息”（访问 `plus.device.uuid`）。

## 8. 调试要点
- 本地 HBuilderX 调试可通过“运行到小程序模拟器”快速验证 `wx.login`、`scene=mp-weixin`；App 端需真机运行以确保 `plus.device.uuid` 可用。
- 若需要临时写死 `WX_APPID/WX_SECRET`，可在 `uniCloud/cloudfunctions/login/index.js` 顶部添加默认值，或通过 `.env` 设置。
- 普通账号切换完全在本机完成：即便云端保存了数据，也必须携带 `device_id` 才能通过 `handleApp`。

## 9. 下一步可扩展
- 在 `user` 云函数中补充“修改昵称/头像”“删除普通账号”等接口，并与 `utils/local-account.js` 联动。
- 根据业务需要拓展 `stats` 字段（如 `best_time`、`games_played`）。
- 若需 App 端绑定微信，可在 `APP-PLUS` 分支中使用微信 SDK 获取 `code`，最终同样调用 `scene='upgrade'`。
