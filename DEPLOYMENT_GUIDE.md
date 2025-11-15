# uni-app 多端兼容与打包指南

本文档旨在为您提供在 `uni-app` 项目中实现多端兼容的最佳实践，并详细说明如何在 HBuilderX 中为不同平台（微信小程序、Android、iOS、鸿蒙）进行运行和打包。

---

### 一、多端兼容实践建议

#### 1. 条件编译 (Conditional Compilation)

条件编译是 `uni-app` 跨端的核心。务必将平台特定的代码包裹在相应的编译块中，以确保代码只在目标平台执行。

- **平台标识符**:
  - `MP-WEIXIN`: 仅在微信小程序平台编译。
  - `APP-PLUS`: 在所有 App 平台编译（包括 Android, iOS, 鸿蒙）。
  - `APP-ANDROID`: 仅在 Android App 编译。
  - `APP-IOS`: 仅在 iOS App 编译。
  - `APP-HARMONY`: 仅在鸿蒙 App 编译 (目前 uni-app 仍主要使用 `APP-PLUS` 覆盖鸿蒙)。

- **代码示例**:
  ```javascript
  // 在 <script> 中使用
  // #ifdef MP-WEIXIN
  console.log('这里是微信小程序');
  // #endif

  // #ifdef APP-PLUS
  console.log('这里是 App 端（安卓、iOS、鸿蒙）');
  const deviceId = plus.device.uuid;
  // #endif
  ```
  ```vue
  <!-- 在 <template> 中使用 -->
  <view>
      <!-- #ifdef MP-WEIXIN -->
      <button open-type="getUserProfile" @click="getProfile">更新微信资料</button>
      <!-- #endif -->
      <!-- #ifdef APP-PLUS -->
      <button @click="guestLogin">游客登录</button>
      <!-- #endif -->
  </view>
  ```

#### 2. 优先使用跨端 API

- **避免平台特定对象**: 尽量避免直接调用 `wx` (微信小程序)、`document` (H5) 或 `plus` (App) 的 API，除非它们被包裹在条件编译块中。
- **使用 `uni` 对象**: `uni-app` 已经将绝大多数常用功能封装到了 `uni` 对象中，例如 `uni.request`, `uni.setStorage`, `uni.login` 等。这些 API 已在内部处理了多端差异，是跨端开发的首选。

#### 3. UI 适配

- **尺寸单位**: 推荐使用 `rpx` (responsive pixel) 作为主要样式单位。它能根据屏幕宽度自适应，有效解决不同尺寸手机的适配问题。
- **安全区域**: 对于 iPhone X 等有“刘海”和“小黑条”的设备，底部内容可能会被遮挡。使用 CSS 的 `env(safe-area-inset-bottom)` 来为底部安全区域留出空间。
  ```css
  .bottom-bar {
      padding-bottom: constant(safe-area-inset-bottom); /* 兼容 iOS < 11.2 */
      padding-bottom: env(safe-area-inset-bottom); /* 兼容 iOS >= 11.2 */
  }
  ```
- **状态栏高度**: 如果您使用自定义导航栏，需要为顶部的状态栏留出空间。可以通过 `uni.getSystemInfoSync().statusBarHeight` 获取高度并应用到样式中。

---

### 二、HBuilderX 运行与打包指南

#### 1. 微信小程序端 (mp-weixin)

- **运行**:
  1. 在 HBuilderX 顶部菜单栏，选择 `运行` -> `运行到小程序模拟器` -> `微信开发者工具`。
  2. HBuilderX 会自动编译项目，并启动微信开发者工具加载小程序代码。
  3. **首次运行**需要在微信开发者工具的 `详情` -> `本地设置` 中勾选 `不校验合法域名...` 选项，以便访问 uniCloud。
- **打包 (上传)**:
  1. 在 HBuilderX 顶部菜单栏，选择 `发行` -> `上传到小程序云`。
  2. 填写版本号和项目备注，点击 `上传`。
  3. 上传成功后，登录 [微信公众平台](https://mp.weixin.qq.com/)，在 `版本管理` 中找到刚上传的版本，提交审核。

#### 2. Android App

- **运行**:
  - **连接真机**: 使用 USB 数据线连接您的 Android 手机，并确保已在手机的系统设置中开启“开发者模式”和“USB调试”。
  - **运行**: 在 HBuilderX 顶部菜单栏，选择 `运行` -> `运行到手机或模拟器` -> `运行到 Android App 基座`。
- **打包**:
  1. 在 HBuilderX 顶部菜单栏，选择 `发行` -> `原生 App-云打包`。
  2. 选择 `Android (apk包)`。
  3. **配置**:
     - **Android包名**: 必须是唯一的，例如 `com.yourcompany.yourapp`。
     - **证书**: 首次打包时，HBuilderX 会提示您生成一个云端证书。请务必**妥善保管证书文件和密码**，因为 App 的后续更新升级必须使用相同的证书进行签名。
  4. 点击 `打包`，等待云端服务器编译完成，然后下载 `.apk` 文件即可。

#### 3. iOS App

- **运行**:
  - **环境要求**: 需要一台 Mac 电脑，并安装 Xcode。
  - **运行**: 在 HBuilderX 顶部菜单栏，选择 `运行` -> `运行到手机或模拟器` -> `运行到 iOS App 基座`。HBuilderX 会生成一个 Xcode 项目，您需要用 Xcode 打开该项目，并连接您的 iPhone 进行真机调试。
- **打包**:
  1. 在 HBuilderX 顶部菜单栏，选择 `发行` -> `原生 App-云打包`。
  2. 选择 `iOS`。
  3. **配置**:
     - **Bundle ID**: 应用的唯一标识，例如 `com.yourcompany.yourapp`。
     - **证书**: 这是 iOS 打包最关键的一步。您需要登录 Apple Developer 网站，创建 App ID，并申请 App 专用的 `p12` 证书和 `mobileprovision` 描述文件。请严格遵循 DCloud 官方的详细教程进行操作。
  4. 点击 `打包`，等待编译完成，下载 `.ipa` 文件。
  5. 使用 `Transporter` 或 `Xcode` 工具将 `.ipa` 文件上传到 App Store Connect 进行审核。

#### 4. 鸿蒙 App (HarmonyOS)

- **当前打包方式**: 目前，`uni-app` 对鸿蒙的支持主要是通过**将 App 编译为 Android 的 `.apk` 包**来实现的。由于鸿蒙系统兼容 Android 应用，因此生成的 `apk` 可以在鸿蒙设备上正常安装和运行。
- **操作流程**: **打包鸿蒙 App 的流程与打包 Android App 完全相同**。请参考上面的 Android App 打包指南。
- **未来展望**: 随着 `uni-app` 对 HarmonyOS NEXT (原生鸿蒙) 的支持逐步完善，未来可能会推出新的打包方式。届时请密切关注 DCloud 官方文档的更新。
