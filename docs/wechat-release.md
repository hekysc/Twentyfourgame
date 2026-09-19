# 微信小程序构建与上传流程

本仓库已经完成 Uni-App Vue 3 CLI 化，并通过 GitHub Actions + 微信官方 `miniprogram-ci` 实际验证了从源码到微信开发版本的自动上传链路。

## 自动发布（推荐）

工作流：`.github/workflows/wechat-release.yml`

PR 到 `main` 时自动执行：

1. 安装依赖。
2. 执行 `npm run build:mp-weixin`。
3. 校验 `dist/build/mp-weixin` 的关键文件。
4. 保存 `mp-weixin` Artifact（30 天）。

合并到 `main` 后，如果提交涉及小程序源码/构建相关路径（如 `pages/**`、`components/**`、`core/**`、`utils/**`、`App.vue`、`main.js`、`pages.json`、`manifest.json`、`package.json` 等），工作流会自动发布微信开发版本并生成预览二维码。纯文档和 CI 配置变更不会触发自动发布。

自动版本号使用 `1.0.<GitHub Actions run number>`，例如 Run #15 对应 `1.0.15`。该编号由 GitHub 单调递增，避免人工维护开发版本号。

手动发布入口继续保留作为故障备用。在 GitHub Actions 的 **WeChat Mini Program** 工作流选择 **Run workflow**：

- Branch：`main`
- Upload a WeChat development version：开启
- Version：使用类似 `1.0.1` 的版本号
- Description：填写本次上传说明

工作流会从 GitHub Actions Secret `WECHAT_PRIVATE_KEY` 临时生成密钥文件，调用 `miniprogram-ci` 上传，并在任务结束时删除临时密钥。

开发版本上传成功后，工作流还会调用 `miniprogram-ci preview` 生成体验/预览二维码，并以 `wechat-preview-qr-<version>` Artifact 保存 7 天。二维码 Artifact 可直接下载用于手机微信扫码测试；临时二维码文件随后与私钥一起从 runner 删除。

> 2026-09-19 已实测：版本 `1.0.1` 成功通过该链路上传到微信开发版本。

## 本地构建

```bash
npm install
npm run build:mp-weixin
```

CLI 构建输出目录：

```
dist/build/mp-weixin
```

`unpackage/` 是 HBuilderX 历史/生成目录，不作为 CI 发布输入，也不要手工修改。

## 本地预览与上传

先在微信公众平台下载对应 AppID 的代码上传密钥，并只保存在安全的本地路径。

macOS/Linux 示例：

```bash
WECHAT_PRIVATE_KEY_PATH=/secure/private.wx58faf81d08ca037c.key \
WECHAT_VERSION=1.0.1 \
WECHAT_PROJECT_PATH=dist/build/mp-weixin \
npm run wechat:preview
```

上传开发版本：

```bash
WECHAT_PRIVATE_KEY_PATH=/secure/private.wx58faf81d08ca037c.key \
WECHAT_VERSION=1.0.1 \
WECHAT_DESC="release 1.0.1" \
WECHAT_PROJECT_PATH=dist/build/mp-weixin \
npm run wechat:upload
```

## 安全与发布边界

- 微信上传私钥不得进入 Git、PR、Issue、日志或聊天正文。
- GitHub 中只保存为 Actions Secret：`WECHAT_PRIVATE_KEY`。
- 普通 PR 构建不会读取 Secret，也不会上传微信；只有命中发布路径的 `main` push 或明确开启 Upload 的手动 workflow_dispatch 才读取上传密钥。
- 发布目录必须是当前 CLI 生成的 `dist/build/mp-weixin`，禁止使用历史 `unpackage` 产物。
- `miniprogram-ci upload` 只产生微信**开发版本**，不会自动提交审核或正式发布。
- 审核与正式发布继续作为独立人工安全门，避免代码合并后直接影响线上用户。
- 如以后需要自动提交审核/发布，应另建受保护的 production Environment，并配置人工审批，不应复用普通构建 Job。

## 依赖可重复性

当前 Uni-App/DCloud 编译器与 `miniprogram-ci` 已固定版本，但仓库暂未提交 `package-lock.json`，因此 CI 仍使用 `npm install`。后续生成并验证 lockfile 后，应切换到 `npm ci`；在此之前不要直接改成 `npm ci`，否则 CI 会因缺少 lockfile 失败。
