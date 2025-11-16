# uniCloud 微信登录配置指南

本文档介绍如何配置 24点游戏项目的 uniCloud 云服务，实现微信登录和云端数据存储。

## 前提条件

1. 已注册 [DCloud 开发者账号](https://dev.dcloud.net.cn/)
2. 已创建微信小程序并获取 AppID 和 AppSecret
3. 已安装 HBuilderX 开发工具

## 配置步骤

### 1. 开通 uniCloud 服务

1. 在 HBuilderX 中打开项目
2. 右键点击 `uniCloud` 目录，选择"云服务空间初始化"
3. 选择阿里云或腾讯云，创建云服务空间
4. 记录云服务空间 ID（spaceId）

### 2. 配置微信小程序登录

#### 2.1 配置云函数环境变量

在 uniCloud 控制台中，为云函数配置环境变量：

**登录云函数 (login)**
```
WX_APPID=你的微信小程序AppID
WX_SECRET=你的微信小程序AppSecret
```

#### 2.2 上传云函数

在 HBuilderX 中右键 `uniCloud/cloudfunctions/login`，选择"上传部署"

同样上传部署以下云函数：
- `user`
- `game`

### 3. 配置数据库表结构

#### 3.1 创建数据表

在 uniCloud 控制台中创建以下数据表：

1. `user` - 用户信息表
2. `game_record` - 游戏记录表
3. `settings` - 系统设置表
4. `uni-id-config` - uni-id 配置表

#### 3.2 导入表结构

将 `uniCloud/database/` 目录下的 schema 文件导入对应的表中：

```
user.schema.json -> user 表
game_record.schema.json -> game_record 表
settings.schema.json -> settings 表
uni-id-config.schema.json -> uni-id-config 表
```

### 4. 配置 uni-id

在 `uni-id-config` 表中插入初始配置：

```json
{
  "bindPhoneToMpWeixin": false,
  "bindAppToMpWeixin": true,
  "mp-weixin": {
    "oauth": {
      "weixin": {
        "appid": "你的微信小程序AppID",
        "appsecret": "你的微信小程序AppSecret"
      }
    }
  }
}
```

### 5. 修改项目配置

#### 5.1 更新 main.js

在项目根目录的 `main.js` 中，确保初始化 uniCloud：

```javascript
import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  
  // 初始化 uniCloud
  if (uniCloud) {
    app.config.globalProperties.$cloud = uniCloud
  }
  
  return {
    app
  }
}
```

#### 5.2 配置云开发

在 `manifest.json` 中添加云开发配置：

```json
{
  "mp-weixin": {
    "appid": "你的微信小程序AppID",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "permission": {
      "scope.userLocation": {
        "desc": "你的位置信息将用于小程序位置接口的效果展示"
      }
    },
    "cloudfunctionRoot": "uniCloud/"
  }
}
```

### 6. 测试登录功能

1. 在微信开发者工具中运行项目
2. 点击"微信快速登录"按钮
3. 确认登录后查看用户信息是否正确显示
4. 检查 uniCloud 控制台中的用户数据是否正确存储

### 7. 数据迁移（可选）

如果项目之前使用本地存储，可以通过以下步骤迁移数据：

1. 在项目中运行代码，检测到本地数据时会提示迁移
2. 点击"迁移数据"按钮
3. 等待迁移完成
4. 验证云端数据是否正确

## 常见问题

### Q: 登录时提示"未配置微信小程序密钥"
A: 检查 login 云函数的环境变量是否正确配置了 WX_APPID 和 WX_SECRET

### Q: 微信登录失败
A: 确认以下几点：
- 微信小程序的 AppID 和 AppSecret 是否正确
- 云函数是否正确部署
- 小程序是否已发布到体验版或正式版

### Q: 数据保存失败
A: 检查数据库表的 schema 是否正确导入，以及云函数权限配置

### Q: 用户头像显示不出来
A: 检查图片 URL 是否可访问，建议使用云存储存储头像

## 部署注意事项

1. **云函数权限**: 确保云函数具有读写数据库的权限
2. **安全规则**: 根据业务需求配置数据库安全规则
3. **网络请求**: 在微信小程序管理后台配置服务器域名白名单
4. **监控告警**: 建议设置云函数的监控告警，及时发现问题

## 扩展功能

项目已支持以下云端功能：
- 微信登录
- 用户信息管理
- 游戏记录存储
- 统计数据分析
- 数据导出
- 多设备同步

可以根据业务需求继续扩展：
- 排行榜功能
- 好友系统
- 成就系统
- 云存档

---

## 技术支持

如遇到配置问题，可以：
1. 查看 HBuilderX 官方文档
2. 在 DCloud 社区提问
3. 检查 uniCloud 控制台的日志和错误信息