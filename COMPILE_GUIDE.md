# 24点游戏编译指南

本文档提供 24点游戏云端版的编译和部署指南。

## 🛠 编译环境

### 前提条件

1. **HBuilderX** (推荐版本: 3.8.0+)
   - 下载地址: [https://www.dcloud.io/hbuilderx.html](https://www.dcloud.io/hbuilderx.html)
   - 选择 "App 开发版" 或 "标准版"

2. **微信开发者工具**
   - 下载地址: [https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

3. **Node.js** (可选，用于命令行编译)
   - 下载地址: [https://nodejs.org/](https://nodejs.org/)

## 📦 项目结构确认

项目已包含以下关键文件：

```
Twentyfourgame-cloud-codex/
├── App.vue                  # 应用入口
├── main.js                  # Vue 应用初始化
├── manifest.json            # 应用配置
├── pages.json               # 页面路由配置
├── uni.scss                 # 全局样式
├── pages/                   # 页面文件
├── components/              # 组件文件
├── utils/                   # 工具函数
├── styles/                  # 样式文件
├── uniCloud/                # 云服务目录
│   ├── cloudfunctions/      # 云函数
│   └── database/            # 数据库表结构
├── package.json             # 项目依赖
└── vite.config.js           # 构建配置
```

## 🚀 编译步骤

### 方法一: 使用 HBuilderX (推荐)

1. **打开项目**
   ```
   文件 → 打开目录 → 选择项目根目录
   ```

2. **配置微信小程序**
   - 打开 `manifest.json`
   - 在 `mp-weixin` 部分填写你的小程序 AppID

3. **运行到微信开发者工具**
   ```
   运行 → 运行到微信开发者工具
   ```

4. **首次编译**
   - HBuilderX 会自动检测项目类型
   - 编译完成后会在微信开发者工具中打开

### 方法二: 使用命令行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **编译微信小程序**
   ```bash
   npm run build:mp-weixin
   ```

3. **编译结果**
   - 编译后的文件会生成在 `unpackage/dist/build/mp-weixin/` 目录
   - 在微信开发者工具中导入该目录

### 方法三: 使用 CLI (需要安装 uni-app CLI)

1. **安装 uni-app CLI**
   ```bash
   npm install -g @dcloudio/uvm
   uvm install latest
   ```

2. **编译**
   ```bash
   uni build -p mp-weixin
   ```

## 🔧 常见编译问题及解决方案

### 1. SCSS 导入错误

**问题**: `Cannot find module '@/styles/variables.scss'`

**解决方案**: 
- 项目已修复此问题，改用普通 CSS
- 如果仍有问题，检查所有 `@import` 语句

### 2. 导入函数不存在

**问题**: `"clearSession" is not exported by "cloud-store.js"`

**解决方案**:
- 已修复导入路径
- `clearSession` 应从 `auth.js` 导入，不是 `cloud-store.js`

### 3. 云服务配置

**问题**: uniCloud 相关错误

**解决方案**:
- 参考 `UNICLOUD_SETUP.md` 配置云服务
- 确保云函数已正确部署

### 4. 微信小程序 AppID

**问题**: 编译成功但运行时提示 AppID 错误

**解决方案**:
- 在 `manifest.json` 中填写正确的小程序 AppID
- 或在微信开发者工具中设置测试号

## 📱 平台特定配置

### 微信小程序

1. **AppID 配置**
   ```json
   // manifest.json
   {
     "mp-weixin": {
       "appid": "你的小程序AppID",
       "setting": {
         "urlCheck": false
       }
     }
   }
   ```

2. **权限配置**
   ```json
   // manifest.json
   {
     "mp-weixin": {
       "permission": {
         "scope.userLocation": {
           "desc": "用于位置相关功能"
         }
       }
     }
   }
   ```

### H5 版本

1. **路由模式**
   ```json
   // manifest.json
   {
     "h5": {
       "router": {
         "mode": "hash"
       }
     }
   }
   ```

### App 版本

1. **图标配置**
   ```json
   // manifest.json
   {
     "app-plus": {
       "distribute": {
         "icons": {
           "android": {
             "hdpi": "unpackage/res/icons/72x72.png"
           }
         }
       }
     }
   }
   ```

## 🎯 发布部署

### 微信小程序发布

1. **代码上传**
   ```
   发行 → 小程序-微信
   ```

2. **版本管理**
   - 在微信开发者工具中点击"上传"
   - 填写版本号和项目备注

3. **提交审核**
   - 登录微信公众平台
   - 在版本管理中提交审核

### H5 发布

1. **打包**
   ```
   发行 → 网站-H5
   ```

2. **部署**
   - 将 `unpackage/dist/build/h5/` 目录内容部署到 Web 服务器

### App 发布

1. **打包**
   ```
   发行 → App-云打包
   ```

2. **配置签名**
   - Android: 配置签名证书
   - iOS: 配置证书和描述文件

## 🔍 调试技巧

### 1. 控制台调试

```javascript
// 在页面中添加调试代码
console.log('用户信息:', await getCurrentUser())
console.log('统计数据:', await readStats())
```

### 2. 云函数调试

```javascript
// 在云函数中添加日志
console.log('云函数参数:', event)
console.log('云函数结果:', result)
```

### 3. 网络请求调试

- 使用 HBuilderX 的网络面板查看请求详情
- 在微信开发者工具中使用 Network 面板

## 📚 相关文档

- [uniCloud 配置指南](./UNICLOUD_SETUP.md)
- [项目功能说明](./README_CLOUD.md)
- [API 文档](./API.md)

## 🆘 技术支持

如遇到编译问题：

1. 检查 HBuilderX 和相关工具是否为最新版本
2. 清理项目缓存: 运行 → 清理
3. 重新导入项目
4. 查看控制台错误信息
5. 参考 DCloud 官方文档

---

🎉 项目已完成所有编译配置，可以正常编译和运行！