# uniCloud + 多端登录与广告改造方案

## 1. 总体架构概览
- **前端**：基于 `uni-app` + Vue3，目标平台 `mp-weixin`、`app-android`、`app-ios`、`app-harmony`。公共逻辑（登录、广告、云函数调用）集中在 `utils/`，页面组件保持跨端 API。
- **后端**：uniCloud（阿里云/腾讯云任一环境），通过云函数/云对象暴露登录、用户、游戏业务接口，使用云数据库存储用户信息、战绩、配置。
- **鉴权**：统一 `user` 表 + token 机制（JWT 或自定义加密），多端通过不同 `scene` 进入 `login` 云函数，创建/更新用户并生成 token。
- **广告**：统一封装 `utils/ad.js`，内部根据条件编译加载 uni-ad Banner/激励视频组件，按平台切换广告位 ID。

```
uni-app（mp-weixin / app）
   │  uniCloud.callFunction / uniCloud.importObject
   ▼
uniCloud cloudfunctions
   ├─ common/auth.js（token）
   ├─ login（多端登录）
   ├─ user（个人资料）
   └─ game（业务数据 + 鉴权示例）
```

## 2. uniCloud 目录结构与职责
```
uniCloud/
  ├── cloudfunctions/
  │      ├── login/              # 统一登录入口
  │      ├── user/               # 用户资料 CRUD、头像昵称同步
  │      ├── game/               # 游戏/战绩/配置接口（示例）
  │      └── common/
  │             ├── auth.js      # token 生成/校验
  │             └── utils.js     # 请求封装、第三方 API
  └── database/
         ├── user.schema.json
         ├── game_record.schema.json
         └── settings.schema.json
```
- **login 云函数**：根据 `scene`（`mp-weixin` / `app`）处理登录逻辑。
  - mp-weixin：通过 `code` 调用 `jscode2session` 获取 `openid/unionid`，写入 `user`。
  - app：支持游客登录（`device_id`）或手机号验证码登录（可拓展 `phone` + `smsCode`）。
  - 成功后返回 `token`、`user` 文档。
- **user 云对象**：
  - `getProfile(token)`、`updateProfile(token, data)`、`bindPhone(token, phone, smsCode)` 等。
  - 负责昵称/头像同步、平台列表记录。
- **game 云函数**：示例 `listRecords`、`addRecord`，演示如何在业务函数中校验 token。
- **common/auth.js**：封装 JWT（示例使用 `uni-id` 类似结构或自定义 HMAC）。
- **database schemas**：定义 `user` / `game_record` / `settings` 字段。

## 3. 数据库字段设计

### 3.1 `user.schema.json`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 云数据库主键 |
| `openid` | string | 微信 openid（mp） |
| `unionid` | string | 绑定同一微信生态账号 |
| `device_id` | string | App 端游客/设备登录标识 |
| `phone` | string | 手机号（可空） |
| `nickname` | string | 昵称（默认“游客”） |
| `avatar_url` | string | 头像 URL |
| `gender` | number | 0 未知、1 男、2 女 |
| `platforms` | array | 已登录平台列表（如 `['mp-weixin','app-android']`） |
| `roles` | array | 权限/身份（普通、VIP 等） |
| `score` | number | 游戏积分 |
| `level` | number | 等级 |
| `created_at` | timestamp | 注册时间 |
| `last_login_at` | timestamp | 最近登录 |
| `extra` | object | 预留扩展字段 |

```json
{
  "bsonType": "object",
  "required": ["nickname", "created_at"],
  "properties": {
    "openid": { "bsonType": "string" },
    "unionid": { "bsonType": "string" },
    "device_id": { "bsonType": "string" },
    "phone": { "bsonType": "string" },
    "nickname": { "bsonType": "string", "default": "游客" },
    "avatar_url": { "bsonType": "string" },
    "gender": { "bsonType": "int", "enum": [0,1,2], "default": 0 },
    "platforms": { "bsonType": "array", "items": { "bsonType": "string" } },
    "roles": { "bsonType": "array", "items": { "bsonType": "string" }, "default": ["user"] },
    "score": { "bsonType": "double", "default": 0 },
    "level": { "bsonType": "int", "default": 1 },
    "created_at": { "bsonType": "date" },
    "last_login_at": { "bsonType": "date" },
    "extra": { "bsonType": "object" }
  }
}
```

### 3.2 `game_record.schema.json`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 主键 |
| `user_id` | string | 关联用户 |
| `result` | string | 成功/失败/用时等 |
| `score_delta` | number | 积分变化 |
| `details` | object | 存放局内操作细节 |
| `created_at` | timestamp | 记录时间 |

```json
{
  "bsonType": "object",
  "required": ["user_id", "created_at"],
  "properties": {
    "user_id": { "bsonType": "string" },
    "result": { "bsonType": "string" },
    "score_delta": { "bsonType": "double", "default": 0 },
    "details": { "bsonType": "object" },
    "created_at": { "bsonType": "date" }
  }
}
```

### 3.3 `settings.schema.json`
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 主键 |
| `key` | string | 设置项名称 |
| `value` | any | 任意类型，存储配置信息 |
| `updated_at` | timestamp | 更新时间 |

```json
{
  "bsonType": "object",
  "required": ["key"],
  "properties": {
    "key": { "bsonType": "string" },
    "value": {},
    "updated_at": { "bsonType": "date" }
  },
  "indexes": [{
    "name": "key_unique",
    "unique": true,
    "fields": { "key": 1 }
  }]
}
```

## 4. 登录云函数与前端封装

### 4.1 `uniCloud/cloudfunctions/login/index.obj.js`
```js
const db = uniCloud.database()
const users = db.collection('user')
const { createToken } = require('../common/auth')
const { callWxJscode2Session } = require('../common/utils')

module.exports = {
  async mpWeixinLogin(code) {
    const session = await callWxJscode2Session(code)
    const { openid, unionid } = session
    let user = await users.where({ openid }).get().then(r => r.data[0])
    const now = Date.now()
    if (!user) {
      const addRes = await users.add({
        openid,
        unionid,
        nickname: '微信用户',
        created_at: now,
        last_login_at: now,
        platforms: ['mp-weixin']
      })
      user = await users.doc(addRes.id).get().then(r => r.data[0])
    } else {
      await users.doc(user._id).update({ last_login_at: now, platforms: db.command.addToSet('mp-weixin') })
      user = { ...user, last_login_at: now }
    }
    const token = createToken(user)
    return { token, user }
  },
  async appLogin({ deviceId, phone, smsCode, platform }) {
    if (!deviceId && !phone) throw new Error('missing credential')
    // TODO: 校验 smsCode，可接入云短信
    const query = phone ? { phone } : { device_id: deviceId }
    let user = await users.where(query).get().then(r => r.data[0])
    const now = Date.now()
    if (!user) {
      const addRes = await users.add({
        ...query,
        nickname: phone ? '手机号用户' : '游客',
        created_at: now,
        last_login_at: now,
        platforms: [platform || 'app-android']
      })
      user = await users.doc(addRes.id).get().then(r => r.data[0])
    } else {
      await users.doc(user._id).update({ last_login_at: now, platforms: db.command.addToSet(platform) })
      user = { ...user, last_login_at: now }
    }
    const token = createToken(user)
    return { token, user }
  },
  async main(event) {
    const { scene } = event
    if (scene === 'mp-weixin') {
      return this.mpWeixinLogin(event.code)
    }
    if (scene === 'app') {
      return this.appLogin(event)
    }
    throw new Error('unsupported scene')
  }
}
```

### 4.2 `common/auth.js`
```js
const jwt = require('jsonwebtoken')
const SECRET = process.env.UNI_APP_TOKEN_SECRET || 'demo-secret'
const EXPIRES_IN = 3600 * 24 * 7

function createToken(user) {
  return jwt.sign({ uid: user._id, roles: user.roles || [] }, SECRET, { expiresIn: EXPIRES_IN })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch (err) {
    throw new Error('TOKEN_INVALID')
  }
}

module.exports = { createToken, verifyToken }
```

### 4.3 前端 `utils/auth.js`
```js
import { getStorage, setStorage } from './store'

const STORAGE_KEY = 'tf24_token'
const USER_KEY = 'tf24_user'

export function getToken() {
  return uni.getStorageSync(STORAGE_KEY) || ''
}

export function setToken(token) {
  uni.setStorageSync(STORAGE_KEY, token)
}

export function getLocalUser() {
  return uni.getStorageSync(USER_KEY) || null
}

export function setLocalUser(user) {
  uni.setStorageSync(USER_KEY, user)
}

export async function wxLogin() {
  const loginRes = await uni.login({ provider: 'weixin' })
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'mp-weixin', code: loginRes.code }
  })
  setToken(result.token)
  setLocalUser(result.user)
  return result
}

export async function getWxProfileAndUpdate() {
  const profile = await uni.getUserProfile({ desc: '用于完善资料' })
  const res = await uniCloud.callFunction({
    name: 'user',
    data: {
      action: 'updateProfile',
      token: getToken(),
      profile: {
        nickname: profile.userInfo.nickName,
        avatar_url: profile.userInfo.avatarUrl,
        gender: profile.userInfo.gender
      }
    }
  })
  setLocalUser(res.result.user)
  return res.result.user
}

export async function appLogin() {
  // #ifdef APP-PLUS
  const deviceId = plus.device.uuid
  const platform = uni.getSystemInfoSync().platform === 'android' ? 'app-android' : 'app-ios'
  const { result } = await uniCloud.callFunction({
    name: 'login',
    data: { scene: 'app', deviceId, platform }
  })
  setToken(result.token)
  setLocalUser(result.user)
  return result
  // #endif
}
```

### 4.4 App.vue `onLaunch`
```js
<script setup>
import { getToken, wxLogin, appLogin } from '@/utils/auth'

onLaunch(async () => {
  const token = getToken()
  if (token) {
    console.log('已登录')
    return
  }
  // #ifdef MP-WEIXIN
  await wxLogin()
  await getWxProfileAndUpdate()
  // #endif

  // #ifdef APP-PLUS
  await appLogin()
  // #endif
})
</script>
```

## 5. 用户云对象示例
`uniCloud/cloudfunctions/user/index.obj.js`
```js
const db = uniCloud.database()
const users = db.collection('user')
const { verifyToken } = require('../common/auth')

module.exports = {
  async updateProfile(event) {
    const payload = verifyToken(event.token)
    const userId = payload.uid
    await users.doc(userId).update({
      ...event.profile,
      updated_at: Date.now()
    })
    const user = await users.doc(userId).get().then(r => r.data[0])
    return { user }
  },
  async getProfile(event) {
    const payload = verifyToken(event.token)
    const user = await users.doc(payload.uid).get().then(r => r.data[0])
    return { user }
  }
}
```

## 6. game 云函数鉴权示例
`uniCloud/cloudfunctions/game/index.js`
```js
const db = uniCloud.database()
const { verifyToken } = require('../common/auth')

exports.main = async (event) => {
  const token = event.token || (event.headers && event.headers.Authorization)
  const payload = verifyToken(token)
  const userId = payload.uid
  if (event.action === 'list') {
    const res = await db.collection('game_record').where({ user_id: userId }).get()
    return { list: res.data }
  }
  if (event.action === 'add') {
    await db.collection('game_record').add({
      user_id: userId,
      result: event.result,
      score_delta: event.scoreDelta,
      created_at: Date.now()
    })
    return { ok: true }
  }
  throw new Error('unsupported action')
}
```

## 7. uni-ad 集成

### 7.1 manifest.json 配置
- **mp-weixin**：`mp-weixin` 配置中启用广告组件，在 `mp-weixin` 后台申请 banner / 激励视频广告位 ID，并填入 `ad.unitId.banner`、`ad.unitId.rewardedVideo`。
- **app-android / app-ios / app-harmony**：在 `app-plus` → `Ad` → 勾选 `uni-ad`，配置 `dcloud_appid`、`uni-ad` appid/secret，分别填写 Android/iOS/Harmony 广告位。

### 7.2 `utils/ad.js`
```js
const bannerIds = {
  'mp-weixin': 'adunit-wx-banner',
  'app': 'adunit-app-banner'
}
const rewardedIds = {
  'mp-weixin': 'adunit-wx-rewarded',
  'app': 'adunit-app-rewarded'
}

export function showBannerAd() {
  // #ifdef MP-WEIXIN
  const ad = uni.createRewardedVideoAd({ adUnitId: bannerIds['mp-weixin'] })
  ad.show()
  // #endif

  // #ifdef APP-PLUS
  const ad = plus.ad.createBannerAd({ adUnitId: bannerIds['app'] })
  ad.show()
  // #endif
}

export function showRewardedAd({ onClose }) {
  // #ifdef MP-WEIXIN
  const ad = uni.createRewardedVideoAd({ adUnitId: rewardedIds['mp-weixin'] })
  ad.onClose(res => {
    onClose && onClose(res && res.isEnded)
  })
  ad.show()
  // #endif

  // #ifdef APP-PLUS
  const ad = uni.createRewardedVideoAd({ adUnitId: rewardedIds['app'] })
  ad.onClose(res => onClose && onClose(res.isEnded !== false))
  ad.show()
  // #endif
}
```

### 7.3 页面示例 `pages/index/index.vue`
```vue
<template>
  <view class="profile">
    <image :src="user.avatar_url" class="avatar" />
    <text>{{ user.nickname }}</text>
  </view>
  <view class="records">
    <view v-for="item in records" :key="item._id">{{ item.result }}</view>
  </view>
  <view class="actions">
    <button @click="onShowAd">看广告获得提示</button>
  </view>
  <!-- #ifdef MP-WEIXIN -->
  <ad unit-id="adunit-wx-banner" ad-type="banner" />
  <!-- #endif -->
  <!-- #ifdef APP-PLUS -->
  <ad unit-id="adunit-app-banner" ad-type="banner" />
  <!-- #endif -->
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getLocalUser } from '@/utils/auth'
import { showRewardedAd } from '@/utils/ad'

const user = ref(getLocalUser())
const records = ref([])

onMounted(async () => {
  const { result } = await uniCloud.callFunction({
    name: 'game',
    data: { action: 'list', token: uni.getStorageSync('tf24_token') }
  })
  records.value = result.list
})

function onShowAd() {
  showRewardedAd({
    onClose: (finished) => {
      if (finished) {
        uni.showToast({ title: '获得提示！' })
      } else {
        uni.showToast({ title: '观看未完成', icon: 'none' })
      }
    }
  })
}
</script>
```

## 8. 多端兼容实践建议
1. **条件编译**：
   ```js
   // #ifdef MP-WEIXIN
   // 微信特有能力：getUserProfile、微信广告
   // #endif

   // #ifdef APP-PLUS
   // plus.* API、App 设备信息、uni-ad App 广告
   // #endif

   // #ifdef APP-HARMONY
   // 鸿蒙差异：设备信息、推送
   // #endif
   ```
2. **跨端 API**：优先使用 `uni.xxx` 接口；如需 `wx` 对象，必须包裹 `#ifdef MP-WEIXIN`。避免直接操作 DOM。
3. **UI 适配**：使用 `safe-area` 样式、`padding-bottom: constant(safe-area-inset-bottom)` 兼容刘海屏；避免绝对定位覆盖虚拟按键。
4. **打包流程**：
   - HBuilderX → `运行到小程序模拟器` / `发行` → `小程序-微信`。
   - `运行到手机或模拟器` → Android；`发行` → `原生App-Android/iOS`。
   - 鸿蒙：HBuilderX 4.x+ 勾选 `app-harmony`，配置 Harmony App 信息，再 `发行` → `HarmonyOS App`。
5. **登录缓存**：多端统一 `storage key`，`APP-PLUS` + 鸿蒙都走 `appLogin()`（游客/设备），避免依赖 Android/iOS 特有 API。
6. **广告降级**：若平台不支持激励视频（如某些 H5 或鸿蒙版本），隐藏按钮或改为“冷却倒计时”逻辑。

## 9. 完整页面示例（含广告 + 多端条件编译）
```vue
<template>
  <view class="page">
    <view class="profile">
      <image :src="user.avatar_url" class="avatar" />
      <view>
        <text class="name">{{ user.nickname || '游客' }}</text>
        <text class="id">ID: {{ user._id }}</text>
      </view>
    </view>

    <view class="stats">
      <text>积分：{{ user.score || 0 }}</text>
      <text>等级：{{ user.level || 1 }}</text>
    </view>

    <view class="records">
      <view class="record" v-for="item in records" :key="item._id">
        <text>{{ item.result }}</text>
        <text class="time">{{ formatTime(item.created_at) }}</text>
      </view>
    </view>

    <button class="ad-btn" @click="watchAd">看广告获得提示</button>

    <!-- Banner 广告 -->
    <!-- #ifdef MP-WEIXIN -->
    <ad unit-id="adunit-wx-banner" ad-type="banner" ad-theme="white" />
    <!-- #endif -->
    <!-- #ifdef APP-PLUS -->
    <ad unit-id="adunit-app-banner" ad-type="banner" />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showRewardedAd } from '@/utils/ad'
import dayjs from 'dayjs'

const token = uni.getStorageSync('tf24_token')
const user = ref(uni.getStorageSync('tf24_user'))
const records = ref([])

onMounted(loadRecords)

async function loadRecords() {
  const { result } = await uniCloud.callFunction({
    name: 'game',
    data: { action: 'list', token }
  })
  records.value = result.list
}

function watchAd() {
  showRewardedAd({
    onClose: (finished) => {
      if (finished) {
        uni.showToast({ title: '获得提示奖励！' })
      } else {
        uni.showToast({ title: '未完成观看', icon: 'none' })
      }
    }
  })
}

function formatTime(ts) {
  return dayjs(ts).format('MM-DD HH:mm')
}
</script>

<style scoped>
.page { padding: 24rpx; }
.profile { display: flex; align-items: center; margin-bottom: 32rpx; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; margin-right: 24rpx; }
.records { max-height: 400rpx; overflow-y: auto; margin-bottom: 24rpx; }
.record { padding: 16rpx 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
.ad-btn { background: #ff8a00; color: #fff; margin: 32rpx 0; }
</style>
```

## 10. 结论
- 通过 uniCloud + 云数据库统一用户、登录、业务逻辑，保证多端一致性。
- 微信端采用 `wxLogin + getUserProfile` 自动同步昵称/头像，App 端游客/手机号登录同表存储。
- `auth.js` 统一 token，所有业务云函数通过 `verifyToken` 保护接口。
- `utils/ad.js` + 条件编译封装 uni-ad，实现 mp-weixin + Android/iOS/鸿蒙 广告展示，并提供激励视频奖励示例。
- 文档列出多端兼容建议与完整页面示例，可直接迁移到现有 uni-app 工程。
