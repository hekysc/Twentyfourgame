# 24点游戏 - 云端版

基于 Uni-App + Vue 3 + uniCloud 的跨平台 24点数学游戏，支持微信登录、云端数据存储和多设备同步。

## 🚀 主要特性

### 🌐 多平台支持
- **微信小程序**: 完整支持，包括微信登录和分享
- **H5 网页**: 响应式设计，支持各种屏幕尺寸
- **App 应用**: 支持 Android、iOS 和鸿蒙系统

### 📱 微信登录
- 一键微信快速登录
- 自动获取用户头像和昵称
- 支持手动编辑用户资料
- 多设备登录状态同步

### ☁️ 云端存储
- 所有游戏数据存储在云端
- 支持多设备数据同步
- 数据安全可靠，不会丢失
- 支持数据导出和备份

### 🎮 双模式游戏
- **Pro 模式**: 拖拽式编辑，自由度高
- **Basic 模式**: 点击式交互，简单直观

### 📊 详细统计
- 多维度时间窗口分析
- 个人趋势图表
- 运算偏好统计
- 连胜记录追踪
- 技能雷达分析

## 🛠 技术栈

- **前端框架**: Vue 3 + `<script setup>` 组合式 API
- **跨平台框架**: Uni-App
- **后端服务**: uniCloud
- **数据库**: 云数据库 (NoSQL)
- **云函数**: Node.js
- **样式处理**: SCSS + rpx 响应式单位

## 📁 项目结构

```
Twentyfourgame-cloud-codex/
├── App.vue                  # 应用入口
├── main.js                  # Vue 应用初始化
├── pages/                   # 页面模块
│   ├── login/               # 登录页面
│   ├── index/               # 游戏主页
│   ├── user/                # 用户管理
│   ├── stats/               # 统计分析
│   └── settings/            # 设置页面
├── components/              # 公共组件
├── utils/                   # 工具函数
│   ├── cloud-store.js       # 云端数据存储
│   ├── auth.js              # 认证相关
│   ├── solver.js            # 24点求解算法
│   └── ...                  # 其他工具
├── uniCloud/                # 云服务目录
│   ├── cloudfunctions/      # 云函数
│   └── database/            # 数据库 schema
├── test-cloud.js            # 云端功能测试
├── UNICLOUD_SETUP.md        # uniCloud 配置指南
└── README_CLOUD.md          # 本文档
```

## 🚀 快速开始

### 1. 环境准备

1. 下载并安装 [HBuilderX](https://www.dcloud.io/hbuilderx.html)
2. 注册 [DCloud 开发者账号](https://dev.dcloud.net.cn/)
3. 申请微信小程序并获取 AppID

### 2. 项目配置

参考 [uniCloud 配置指南](./UNICLOUD_SETUP.md) 完成以下配置：

1. 开通 uniCloud 服务
2. 配置微信小程序登录
3. 部署云函数
4. 创建数据库表

### 3. 本地开发

1. 使用 HBuilderX 打开项目
2. 配置微信小程序 AppID (在 `manifest.json` 中)
3. 运行到微信开发者工具或浏览器

### 4. 功能测试

在浏览器控制台运行测试用例：

```javascript
// 导入测试模块
import CloudTests from './test-cloud.js'

// 运行所有测试
CloudTests.runAllTests()

// 单独测试登录功能
CloudTests.testLogin()
```

## 🎯 核心功能

### 微信登录流程

1. **获取授权码**: 调用 `uni.login()` 获取临时登录凭证
2. **云端验证**: 云函数向微信服务器验证 code
3. **用户创建**: 首次登录自动创建用户记录
4. **Token 签发**: 云端生成 JWT token 返回给客户端
5. **状态维持**: 客户端存储 token 用于后续请求

### 数据同步机制

1. **本地缓存**: 使用 5 分钟缓存减少网络请求
2. **实时更新**: 游戏记录实时保存到云端
3. **冲突处理**: 基于时间戳的简单冲突解决
4. **离线支持**: 本地暂存，网络恢复后自动同步

### 统计分析系统

1. **基础统计**: 总场次、胜率、平均时间
2. **时间维度**: 今天、3天、7天、30天、全部
3. **行为分析**: 运算符偏好、表达式长度
4. **趋势追踪**: 连胜记录、最佳时间

## 🔧 开发指南

### 添加新的云函数

1. 在 `uniCloud/cloudfunctions/` 目录下创建新文件夹
2. 编写 `index.js` 和 `package.json`
3. 在 HBuilderX 中右键选择"上传部署"

### 扩展数据表结构

1. 修改 `uniCloud/database/` 下的 schema 文件
2. 在 uniCloud 控制台中导入更新的 schema
3. 更新相关的云函数逻辑

### 本地测试

```javascript
// 测试登录
import { wxLogin } from './utils/auth.js'
const session = await wxLogin()

// 测试数据存储
import { pushRound } from './utils/cloud-store.js'
await pushRound({ success: true, timeMs: 30000 })
```

## 📱 平台特性

### 微信小程序

- ✅ 微信登录授权
- ✅ 用户信息获取
- ✅ 分享到好友和朋友圈
- ✅ 云端数据同步

### H5 网页

- ✅ 响应式设计
- ✅ 浏览器兼容性
- ✅ 本地存储回退
- ⚠️ 部分功能受限 (如微信登录)

### App 应用

- ✅ 设备唯一标识登录
- ✅ 本地数据缓存
- ✅ 离线游戏支持
- ✅ 原生性能优化

## 🔒 数据安全

- **Token 认证**: JWT token 验证用户身份
- **权限控制**: 基于用户 ID 的数据隔离
- **数据加密**: 敏感信息传输加密
- **安全规则**: 数据库访问权限限制

## 🚀 部署发布

### 微信小程序

1. 在微信开发者工具中上传代码
2. 提交审核并发布
3. 配置服务器域名白名单

### H5 部署

1. 使用 HBuilderX 打包为 H5
2. 部署到静态服务器
3. 配置 HTTPS 和域名

### App 打包

1. 配置应用图标和启动页
2. 设置应用权限
3. 使用 HBuilderX 云打包

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支
3. 提交代码变更
4. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

## 🆘 常见问题

**Q: 登录时提示"未配置微信小程序密钥"**  
A: 检查 uniCloud 控制台中的云函数环境变量配置

**Q: 数据同步失败**  
A: 检查网络连接和云函数部署状态

**Q: 头像显示不出来**  
A: 确认图片 URL 可访问，建议使用云存储

## 📞 技术支持

- 📧 邮箱: support@example.com
- 💬 微信群: 扫描二维码加入
- 📱 QQ群: 123456789

---

感谢使用 24点游戏云端版！如有问题或建议，欢迎反馈。🎉