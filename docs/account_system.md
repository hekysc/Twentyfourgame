# 账号体系与登录改造说明

本文件描述了微信账号 + 本机多账号的统一实现，包括云函数、数据库 Schema 与前端页面改造要点。

## 1. 云函数 `login`（uniCloud/cloudfunctions/login/index.js）

- 入口通过 `event.scene` 区分三种流程：
  - `mp-weixin`：`wx.login` → `code` → `fetchWeixinSession`，使用 `openid`/`unionid` 创建或更新微信账号。
  - `app`：依赖 `deviceId` + `user_id` 进行本机普通账号登录；若未传 `user_id` 则直接创建一个新的普通账号（昵称来源于 `extra.nickname` 或默认值）。
  - `upgrade`：把本机普通账号升级为微信账号，或与已有微信账号合并（`score` 取最大、`coins` 求和）。
- 所有场景返回 `{ token, user }`，其中 `token = createToken({ user_id, account_type })`，`user` 会去掉 `device_id` 并补全 `stats`。
- 微信凭证读取优先级：`process.env.WX_APPID/WX_SECRET` → `process.env.MP_WEIXIN_*` → `uniCloud.getConfig().weixin`。
- 关键辅助函数：
  - `fetchWeixinSession(code)`：调用 `https://api.weixin.qq.com/sns/jscode2session`。
  - `handleMpWeixin` / `handleApp` / `handleUpgrade`：按 PRD 拆分逻辑。
  - `mergeStats`、`ensureStats`：确保统计字段可被安全合并。

## 2. 数据库 `user` Schema（uniCloud/database/user.schema.json）

- 字段核心：`account_type`（`weixin|local`）、`openid`、`device_id`、`stats` 等。
- `openid` 设置唯一索引（允许为空）。
- 允许重复昵称；普通账号必须存 `device_id` 以限制本机使用。
- `merged_to`/`merged_at` 字段用于记录升级后本地账号的归属。

## 3. 前端页面改造指引

### 3.1 登录方式选择页（`pages/login/index.vue`）

```vue
<template>
  <view class="login-entry">
    <!-- #ifdef MP-WEIXIN -->
    <button @tap="wxLogin">微信登录</button>
    <!-- #endif -->
    <button @tap="gotoLocalAccounts">普通账号登录</button>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const loading = ref(false)

function gotoLocalAccounts () {
  uni.navigateTo({ url: '/pages/user/local-list' })
}

async function wxLogin () {
  loading.value = true
  try {
    const { code } = await uni.login({ provider: 'weixin' })
    const res = await uniCloud.callFunction({
      name: 'login',
      data: { scene: 'mp-weixin', code, platform: 'mp-weixin' }
    })
    handleLoginSuccess(res.result)
  } finally {
    loading.value = false
  }
}
</script>
```

### 3.2 普通账号列表页（`pages/user/local-list.vue`）

- 本地缓存：`const localAccounts = ref(uni.getStorageSync('local_accounts') || [])`。
- 列表项结构：`{ user_id, nickname, avatar_url, created_at }`，点击后按如下流程登录：

```js
async function loginLocal(account) {
  const deviceId = await resolveDeviceId()
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'app', deviceId, user_id: account.user_id, platform: currentPlatformTag }
  })
  persistSession(result)
}
```

- `resolveDeviceId`：
  - `#ifdef APP-PLUS` 使用 `plus.device.uuid`。
  - `#ifdef MP-WEIXIN` 兜底可使用 `uni.getStorageSync('tf24_device_id')`，无则随机生成 UUID 并写入 storage。
- 新建按钮跳转到“普通账号创建页”。
- 长按操作：
  - `renameLocalAccount(account)`：更新 `local_accounts` 与后端（可复用 `user` 云对象）。
  - `removeLocalAccount(account)`：本地删除后可调用后端标记。

### 3.3 普通账号创建页（`pages/user/local-create.vue`）

```vue
<script setup>
import { ref } from 'vue'

const nickname = ref('')
const avatarUrl = ref('')

async function submit () {
  if (!nickname.value) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  const deviceId = await resolveDeviceId()
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: {
      scene: 'app',
      deviceId,
      platform: currentPlatformTag,
      extra: { nickname: nickname.value, avatar_url: avatarUrl.value }
    }
  })
  const list = uni.getStorageSync('local_accounts') || []
  list.push({
    user_id: result.user._id,
    nickname: result.user.nickname,
    avatar_url: result.user.avatar_url,
    created_at: Date.now()
  })
  uni.setStorageSync('local_accounts', list)
  persistSession(result)
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>
```

### 3.4 升级为微信账号（`pages/user/profile.vue`）

```js
async function upgradeToWeixin () {
  if (currentUser.account_type !== 'local') return
  const { code } = await uni.login({ provider: 'weixin' })
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'upgrade', code, user_id: currentUser._id, platform: 'mp-weixin' }
  })
  persistSession(result)
  syncLocalAccountAfterUpgrade(currentUser._id, result.user._id)
}
```

- `syncLocalAccountAfterUpgrade`：可以删除或标记旧的本地账号，提示“已升级为微信账号，可跨设备登录”。

## 4. 账号体系说明

| 项目 | 微信账号 | 普通账号 |
| --- | --- | --- |
| account_type | `weixin` | `local` |
| 唯一标识 | `openid`/`unionid` | `_id` + `device_id` |
| 登录范围 | 跨设备 | 仅创建设备 |
| 创建方式 | 小程序 `wx.login` | App/小程序内“新建普通账号” |
| 升级 | 不需要 | 可升级到微信账号，数据合并 |

- 升级时：`score = max(local.score, weixin.score)`、`coins = local.coins + weixin.coins`。
- 本地列表仅保存基本展示信息，真实数据仍以云端为准。

## 5. 调试与配置

- **微信凭证**：开发阶段可在 `uniCloud/cloudfunctions/login/index.js` 使用的环境变量中临时写死：
  - HBuilderX 本地调试：在 `uniCloud-aliyun/cloudfunctions/login/config.json`（若有）或 `uniCloud/cloudfunctions/login/config.json` 中写入 `"WX_APPID"`、`"WX_SECRET"`。
  - 也可在 CI/部署环境下通过 `uniCloud env` 设置 `WX_APPID`、`WX_SECRET`，不建议在代码库中硬编码正式密钥。
- **manifest.json**：
  - App 端需启用 `uniCloud`、`push`、`secure HTTPS` 权限，并确保 `APP-PLUS` 平台可读取 `plus.device.uuid`。
  - 微信小程序勾选“需要用户信息”、“使用云函数”并填写 `AppID`。
- **小程序后台**：
  - 业务域名需包含 `https://api.weixin.qq.com`（默认已允许）。
  - 在“开发管理 → 开发设置”中配置云开发环境、上传合法的 request 域名（若使用自定义域名访问 uniCloud HTTP 服务）。
  - 需要在“开发管理 → 服务器域名”中添加 `https://api.weixin.qq.com` 以及 `https://<your-unicloud-endpoint>`（若使用 HTTP 调用）。

## 6. 其他建议

- `local_accounts` 建议与登录状态联动，若云端账号被合并/删除，可在下一次登录失败时清理本地缓存。
- 若后续需要手机号码、邮箱等登录方式，可在 `account_type` 基础上扩展 `credential` 字段，并在 `login` 云函数中新增 `scene`。
- 可在 `docs/uniCloud_rework.md` 的基础上继续扩展更多云函数或页面示例。
