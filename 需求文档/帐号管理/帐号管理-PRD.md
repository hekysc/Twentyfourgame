好的，我将基于你确认的需求，为你产出 **专业级完整 PRD 文档**，可直接交付给产品、开发、测试团队使用。
内容包含：产品背景、用户故事、账号体系、数据结构、流程图、异常流程、升级流程、安全策略、未来扩展等。

---

# 📘 **《账号体系 PRD 文档（v1.0）》**

适用：uni-app（多端） + uniCloud
适配端：微信小程序 / Android / iOS / 鸿蒙

编写者：ChatGPT（根据需求自动生成）
确认者：xxx
日期：2025-xx-xx

---

# 1. 产品背景（Background）

当前项目需要实现一个“本机多账号 + 微信账号”的混合账号体系，满足以下需求：

* 支持用户选择**微信账号登录**或**普通账号（本机账号）**登录。
* 普通账号可在本机创建多个，每个账号有自己的进度 / 数据。
* 普通账号不允许跨设备，但数据要同步到云端（用于榜单、数据安全、后续升级）。
* 微信账号可跨设备登录（微信标准）且数据随账号走。
* 日后普通账号可以“升级为微信账号”，数据合并后继续使用微信账号体系。

系统需确保唯一性安全性，同时保持用户体验简洁、无负担。

---

# 2. 用户故事（User Stories）

### 2.1 微信用户

* 作为一名用户，我希望可以一键使用微信登录，不需要创建账号。
* 作为一名用户，我希望换手机后依然保留我的数据。
* 作为一名用户，我希望头像昵称自动从微信获取。

### 2.2 普通用户（游客模式强化版）

* 作为一名用户，我不想授权微信，也能创建一个名字，选择一个头像开始游戏。
* 作为一名用户，我希望在本机上能创建多个账号给家人使用（如：自己 + 孩子）。
* 作为一名用户，我希望以后可以把普通账号升级为微信账号，不丢失我的数据。

### 2.3 系统与运营方

* 作为运营，我需要云端能统计所有账号的数据（包括普通账号）。
* 作为开发，我希望账号体系清晰、稳定，并方便未来扩展。

---

# 3. 账号体系整体设计（Account System Architecture）

系统提供两类账号：

---

## 3.1 微信账号（强账号）

特征：

* 身份标识：`openid`（必要）+ `unionid`（可选）
* 登录方式：微信授权
* 数据存储：云端
* 可跨设备
* 可覆盖普通账号（升级）

结构：

```
wechat_user: {
  user_id,
  openid,
  unionid,
  nickname,
  avatar_url,
  platforms,
  created_at,
  last_login_at,
  stats: { ... },
  ...
}
```

---

## 3.2 普通账号（弱账号，本机专属）

特征：

* 身份标识：`user_id`（系统生成 UUID）
* 登录方式：本地选择账号 → 使用 `device_id` 验证
* 昵称：允许重复
* 支持多个本地账号
* 只能在创建它的手机使用
* 数据存储：本机 + 云端（但云端禁止通过 openid/手机号登录）
* 可升级为微信账号

结构：

```
local_user: {
  user_id,
  device_id: '本机唯一',
  nickname,
  avatar_url,
  created_at,
  last_login_at,
  stats: { ... }
}
```

云端存储结构示例：

```
cloud_user: {
  user_id,
  device_id,
  nickname,
  avatar_url,
  created_at,
  last_sync_time,
  stats: {...}
}
```

---

# 4. 账号唯一性策略（Identity Uniqueness）

| 项目    | 微信账号   | 普通账号          |
| ----- | ------ | ------------- |
| 唯一标识  | openid | user_id（UUID） |
| 头像    | 微信头像   | 系统头像 / 相册上传   |
| 昵称唯一性 | 可重复    | 可重复           |
| 多设备   | 支持     | 不支持           |
| 多账号   | 支持切换   | 支持同一设备多账号     |

特殊约束（普通账号）：

* 登陆必须携带 `device_id`，服务器确认：
  `cloud_user.device_id === 本机 device_id`
  否则拒绝登录。
* 云端数据无法用于跨设备恢复。

---

# 5. 数据结构（Database Schema）

### user 表（统一管理微信用户 + 普通用户）

字段：

| 字段名           | 类型     | 说明                                   |
| ------------- | ------ | ------------------------------------ |
| _id           | string | user_id（主键）                          |
| openid        | string | 微信账号使用                               |
| unionid       | string | 微信账号使用                               |
| device_id     | string | 普通账号绑定的设备 ID                         |
| nickname      | string | 昵称（可重复）                              |
| avatar_url    | string | 头像 URL                               |
| account_type  | string | `weixin` or `local`                  |
| platforms     | array  | 登录过的端，例如 ['mp-weixin','app-android'] |
| created_at    | number | 创建时间                                 |
| last_login_at | number | 最后登录                                 |
| stats         | object | 战绩、分数、进度等                            |

---

# 6. 客户端信息流（Client Data Flow）

## 6.1 本地存储：仅管理普通账号

```js
local_accounts = [
  {
    user_id: 'uuid1',
    nickname: '小明',
    avatar_url: '/static/avatar/a1.png',
    created_at: 123123,
  },
  {
    user_id: 'uuid2',
    nickname: '妈妈',
    ...
  }
]
```

存储在：

```
uni.setStorageSync('local_accounts', ...)
```

本机只能选择其中一个登录。

---

# 7. 登录流程设计（Login Flows）

---

## 7.1 微信账号登录流程

**场景：用户点击“微信登录”按钮**

```
用户 → 前端 → wx.login() → code
           ↓
       uniCloud.callFunction('login', { scene:'mp-weixin', code })
           ↓
   云函数：jscode2session → openid
           ↓
  查 user 表有无 openid
      ↓是                    ↓否
   返回该用户            创建新记录 + 返回
```

前端保存：

```
token + user_info
```

---

## 7.2 普通账号登录流程

**场景：用户选择“普通账号：小明”**

流程：

```
前端 → 读取 local_accounts
    → 选择某 user_id
    → 获取 device_id（plus.device.uuid 或小程序 deviceId）
    → 调 login 云函数 { scene:'app', user_id, device_id }
```

云端验证：

* 必须存在该 user_id
* cloud_user.device_id === 本机 device_id
* 否则拒绝

成功后返回 token（仅用于权限校验，不用于跨设备登录）。

---

## 7.3 普通账号创建流程

```
用户输入昵称
↓
选择头像
↓
生成 user_id（UUID）
↓
device_id = 当前设备
↓
本地保存 local_accounts
↓
云端写入 user（account_type = 'local'）
↓
登录成功
```

昵称可重复，无需校验唯一性。

---

# 8. 普通账号 → 微信账号升级

### 场景：用户后来决定绑定微信

```
前端：
点击 “绑定微信”
  ↓
wx.login 获取 code
  ↓
调用 cloud/login { scene:'upgrade', code, old_user_id }
```

云端逻辑：

1. 通过 code 获取 openid
2. 检查是否已有 openid 账号

   * 如果有：把普通账号数据合并覆盖到微信账号
     -如果没有：把当前普通账号更新为微信账号（设置 account_type='weixin'，写入 openid）
3. 删除对应的普通账号记录（或保留作为冗余备份）
4. 返回微信账号 token

前端更新 UI：

* 隐藏普通账号
* 标记为微信账号
* 更新头像 + 昵称

---

# 9. 本机多账号管理（Local Accounts）

## 功能点：

* 添加账号
* 删除账号
* 修改昵称
* 修改头像
* 切换账号
* 展示当前登录账号

本地结构：

```
local_accounts = [
  { user_id, nickname, avatar_url, created_at },
  ...
]
```

当删除账号时：

* 可选择“仅本地删”和“云端一起删”（不同业务可选）

---

# 10. 云端安全策略（Security）

### 微信账号

* 使用 `openid` 强唯一
* token 使用 uni-id 或自定义 JWT
* token 过期需刷新

### 普通账号

* device_id 强绑定
* 每次 login must verify device_id
* 云端拒绝非本设备访问
* 数据同步到云端但不能跨机恢复
* 用户可清除本地账号（但云端保留或删除按业务选择）

### 防止伪造设备 ID

* 小程序端：使用 `uni.getSystemInfoSync()` + `wx.getUserCloudStorage()` + 云端签名
* App 端：使用 plus.device.uuid
* 附加 cloud-side salt 校验（如：device_hash = sha256(deviceId + secret)）

---

# 11. 异常场景（Edge Cases）

| 场景              | 处理                 |
| --------------- | ------------------ |
| 用户换手机，但尝试登录普通账号 | 拒绝：提示“此账号仅限本机使用”   |
| 普通账号数据损坏        | fallback：从云端拉取最近备份 |
| 用户清除 App 数据     | 让用户重新创建普通账号或绑定微信   |
| 普通账号创建重复昵称      | 允许（不冲突）            |
| 微信取消授权          | 提示用户再次授权           |

---

# 12. API & 云函数设计

### login 云函数（已实现）

入参：

```
scene: 'mp-weixin' | 'app' | 'upgrade'
code
user_id
device_id
```

返回：

```
{ token, user }
```

> PRD 可同时附上请求/响应 schema，但暂省略。

---

# 13. 页面需求（前端页面）

### ① 选择登录方式页

* 登录按钮（微信登录 / 普通账号登录）
* 普通账号列表（本地）
* 添加普通账号入口

### ② 普通账号创建页

* 输入昵称
* 选择头像（系统预置 + 相册）
* 创建账号 → 登录

### ③ 账号升级页（绑定微信）

* 显示当前普通账号信息
* 有个“绑定微信”按钮

---

# 📌 附录：流程图（ASCII 版）

## **普通账号登录流程**

```
[选择账号] → [读取 user_id] → [获取 device_id]
       → 调 login(app, user_id, device_id)
       → 云端检查 device_id
       → YES → 登录成功
       → NO  → 拒绝（仅本机）
```

## **微信登录流程**

```
[wx.login] → code
→ login(mp-weixin, code)
→ jscode2session → openid
→ 查用户 → 登录/创建
```

## **普通账号升级为微信账号**

```
点击绑定微信
↓
wx.login(code)
↓
login(upgrade, code, old_user_id)
↓
云端：openid 账号不存在 → 覆盖 old_user
openid 账号已存在 → 合并数据
↓
返回新微信账号 token
```

---