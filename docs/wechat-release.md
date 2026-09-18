# 微信小程序构建与上传流程

本仓库是 Uni-App + Vue 3 的 HBuilderX 工程。发布链路分成两个明确阶段：

1. **Uni-App 编译**：源码编译为微信小程序工程。
2. **微信 CI 上传**：使用微信官方 `miniprogram-ci` 将编译结果上传为微信开发版本。

## 当前推荐流程

### 1. 编译 mp-weixin

当前仓库属于 HBuilderX 可视化工程，编译器不在仓库内。使用 HBuilderX 发行到微信小程序，输出目录应为：

```
unpackage/dist/build/mp-weixin
```

不要直接编辑该目录。后续如完成 CLI 工程迁移，可将这一步改为 `npm run build:mp-weixin`。

### 2. 安装上传工具

```bash
npm install
```

### 3. 配置微信代码上传密钥

在微信公众平台为 AppID `wx58faf81d08ca037c` 下载代码上传密钥，并配置 IP 白名单。

密钥只保存在发布机器，不得提交 Git。推荐文件名：

```
private.wx58faf81d08ca037c.key
```

### 4. 预览

macOS/Linux:

```bash
WECHAT_PRIVATE_KEY_PATH=/secure/private.wx58faf81d08ca037c.key \
WECHAT_VERSION=1.0.0 \
npm run wechat:preview
```

PowerShell:

```powershell
$env:WECHAT_PRIVATE_KEY_PATH="C:\secure\private.wx58faf81d08ca037c.key"
$env:WECHAT_VERSION="1.0.0"
npm run wechat:preview
```

默认生成 `wechat-preview.jpg`。

### 5. 上传开发版本

macOS/Linux:

```bash
WECHAT_PRIVATE_KEY_PATH=/secure/private.wx58faf81d08ca037c.key \
WECHAT_VERSION=1.0.0 \
WECHAT_DESC="release 1.0.0" \
npm run wechat:upload
```

PowerShell:

```powershell
$env:WECHAT_PRIVATE_KEY_PATH="C:\secure\private.wx58faf81d08ca037c.key"
$env:WECHAT_VERSION="1.0.0"
$env:WECHAT_DESC="release 1.0.0"
npm run wechat:upload
```

可选变量：

- `WECHAT_APPID`：默认读取当前项目 AppID。
- `WECHAT_PROJECT_PATH`：默认 `unpackage/dist/build/mp-weixin`。
- `WECHAT_CI_ROBOT`：默认机器人编号 1。
- `WECHAT_QR_PATH`：预览二维码输出位置。

## 安全要求

- 微信上传私钥不得进入 Git、PR、Issue、日志或聊天正文。
- 发布机器的出口 IP 必须符合微信公众平台的 IP 白名单配置。
- 正式上传前必须确认编译目录来自当前待发布源码，而不是历史构建残留。
- `miniprogram-ci upload` 只上传开发版本；审核与正式发布按微信公众平台发布流程执行。

## 后续自动化

当前最大限制是本仓库仍是 HBuilderX 工程：HBuilderX CLI 支持小程序持续集成，但 HBuilderX 不支持 Linux，因此不能直接把现有工程无改造地放到常规 Linux GitHub-hosted runner 完成编译。

下一阶段建议先在独立分支验证“CLI 工程化迁移”：引入官方 Uni-App Vue 3 CLI 编译器并确保生成的 mp-weixin 与现有 HBuilderX 构建行为一致。验证通过后，再把“源码构建 + miniprogram-ci 上传”合并成一条 GitHub Actions/自托管 CI 流水线。
