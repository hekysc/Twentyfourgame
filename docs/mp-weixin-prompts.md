# 微信小程序（mp-weixin）打包适配提示词

以下提示词可直接复制分发给团队成员或自用，帮助在 HBuilderX 中将 Uni-App 项目打包为微信小程序时快速排查兼容性问题。可按块使用。

---

## 提示词 1｜是否需要改代码（判定与总要求）

**目标**：将现有 uni-app 项目在 HBuilderX 打包到 **mp-weixin（微信小程序）**，功能与样式保持一致。
**判定**：

* 若项目未使用浏览器 DOM/Window、未依赖仅 H5/APP 可用的插件，且页面导航/路由均走 `pages.json`，通常**无需大改**，只需在 `manifest.json` 配置好 **微信小程序 AppID** 并打包。
* 若存在以下任一项，需按后续提示做替换或条件编译：

  1. 直接操作 DOM（如 `document.querySelector`、`window.addEventListener`）；
  2. 使用仅 H5/APP 生效的组件/插件（如原生 HTML、某些三方 UI 组件未适配 mp-weixin）；
  3. 使用不兼容 API（如 `localStorage`、`FileReader`、`WebSocket` 非 uni 封装等）；
  4. 使用 `<web-view>` 承载核心功能；
  5. 依赖不兼容 Canvas 绘图库或音视频库。

**统一要求**：

* 尽量使用 `uni.*` 跨端 API 和 `<view>/<text>/<image>` 等跨端基础组件；
* 路由统一由 `pages.json` 驱动；
* 平台差异用条件编译包裹（见提示词 3）。

---

## 提示词 2｜常见组件/API 替换（跨端化）

**把下面的替换规则全局搜一遍并处理：**

* DOM/H5 → uni/小程序能力：

  * `document/window/localStorage` → `uni.getStorageSync/uni.setStorageSync`；
  * `fetch/axios(直连)` → `uni.request`；
  * `setTimeout/Interval` 可保留；CSS 动画优先。
* 图片与路径：

  * 统一用 `<image :src="xxx" mode="widthFix"/>`；文件放 `static/` 或通过网络 URL。
* 文件与上传：

  * `input type="file"` → `uni.chooseImage/uni.uploadFile`。
* Canvas/绘图：

  * 三方库不兼容时，退回 `uni.createCanvasContext` 或使用兼容的小程序绘图库；
  * 不要依赖 `canvas.toDataURL`（小程序不同）。
* 路由跳转：

  * 统一 `uni.navigateTo/uni.switchTab/uni.reLaunch/uni.redirectTo`，不要用浏览器地址跳转。
* 存储与状态：

  * 统一 `uni.setStorage*( )/uni.getStorage*( )`；避免直接用 `sessionStorage/localStorage`。
* 授权与登录：

  * 不使用 `open-type="getUserInfo"` 老方案；改为自身业务登录或后端接口；如必须获取头像昵称，用 `button open-type="chooseAvatar"`（头像）+ 普通表单填昵称，或走后端绑定。

---

## 提示词 3｜条件编译模板（跨端差异最小化）

**在存在平台差异的代码段外包裹：**

```vue
<!-- 仅小程序生效 -->
<!-- #ifdef MP-WEIXIN -->
<view class="wx-only">…</view>
<!-- #endif -->

<!-- 排除小程序（仅 H5/APP 生效） -->
<!-- #ifndef MP-WEIXIN -->
<view class="not-wx">…</view>
<!-- #endif -->
```

**脚本里也可用：**

```js
// #ifdef MP-WEIXIN
const isWx = true
// #endif

// #ifndef MP-WEIXIN
const isWx = false
// #endif
```

---

## 提示词 4｜pages.json 与导航统一

**请按以下规范自查并调整：**

* 所有页面路由**只在 `pages.json`** 声明，不在代码里手写路径拼接；
* 使用 `tabBar` 的场景，所有 tab 页必须在 `pages.json` 中的 `tabBar.list` 与 `pages` 同步；
* 页标题：统一 `navigationBarTitleText`；
* 胶囊/返回箭头：使用页面栈和 `navigationStyle` 控制；不要依赖系统物理返回替代路由。

---

## 提示词 5｜manifest.json（微信小程序）设置与“小游戏”误判修正

**在 HBuilderX → manifest.json：**

1. 选择「微信小程序」平台，填入 **小程序 AppID**；
2. 若导入微信开发者工具时**被识别成“小游戏”**：

   * 确认 HBuilderX 的发行目标为 **小程序**（mp-weixin），而非 **小游戏**（game）；
   * 删除之前导入到微信开发者工具的项目，重新用 **“小程序”** 类型创建并导入 `unpackage/dist/build/mp-weixin/`；
   * 不要手动创建或要求 `game.json`；小程序会生成 `app.json`；
   * 如果曾在 `project.config.json` 里选过“小游戏”，请改成“小程序”并重新导入；
   * 清理旧的 `unpackage/dist/build/mp-weixin` 后重新编译再导入。

---

## 提示词 6｜样式与资源规范

* 单位尽量使用 `rpx`，避免固定 `px` 造成不同机型错位；
* 避免 `position: fixed` 盖住系统胶囊，必要时用 `navigationStyle:"custom"` 并自绘；
* 图片放 `static/`，引用相对路径或网络 URL；
* 字体与第三方在线 CSS 尽量不用（小程序环境限制多），必要时将所需样式本地化。

---

## 提示词 7｜构建与导入（一步到位）

1. HBuilderX：**发行 → 小程序-微信**；
2. 构建产物在 `unpackage/dist/build/mp-weixin/`；
3. 打开 **微信开发者工具** → 选择「小程序」→ 导入该目录（保持与 AppID 一致）；
4. 项目设置里关闭/开启 ES6 转 ES5、增强编译等按需调试；
5. 预览与真机联调，关注授权弹窗、网络域名白名单、分包加载等。

---

## 提示词 8｜功能自测清单（验收标准）

* ✅ 首屏无报错，页面栈返回正常；
* ✅ 所有跳转均使用 `uni.navigateTo/uni.switchTab/...`；
* ✅ 登录/头像/昵称流程可用（不依赖旧 `getUserInfo`）；
* ✅ 图片、音频、Canvas、长列表渲染性能可接受；
* ✅ 本地存储与网络请求走 `uni.*` 封装；
* ✅ 冷启动与分包加载无白屏异常；
* ✅ 微信开发者工具与真机均通过。

---

## 提示词 9｜把“系统返回箭头”统一隐藏/控制

```json
// pages.json 中的页面项
{
  "path": "pages/index/index",
  "style": {
    "navigationStyle": "custom"   // 自绘标题栏，系统返回箭头不显示
  }
}
```

> 若需要保留系统导航但在**所有页面**隐藏返回钮：采用统一自绘导航或在需要的页面使用 `navigationStyle:"custom"`。

---

## 提示词 10｜常见报错快速定位

* **导入后提示需要 `game.json`**：说明建成了“小游戏”，按提示词 5 重新以**小程序**导入。
* **[Vue warn] injection router…**：不要在小程序端自行挂载 Vue Router；路由交给 `pages.json`。
* **图片不显示/路径错**：确认资源在 `static/` 或使用线上 URL，路径不以 `/` 开头的非法别名。
* **localStorage 未定义**：改用 `uni.setStorageSync/uni.getStorageSync`。
* **第三方 UI 不生效**：检查是否支持 mp-weixin，必要时换 uni-ui 或做条件编译。

---

将上述提示词按需组合应用，一般无需改动核心业务逻辑即可顺利在 HBuilderX 中打包成微信小程序；只有在命中不兼容项（DOM、特定三方库等）时做针对性替换或条件编译。若需要，也可以针对具体代码片段进行“mp-weixin 适配体检”，直接标记需调整的行。
