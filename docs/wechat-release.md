# 微信小程序构建与上传流程

本仓库通过 GitHub Actions 和微信官方 `miniprogram-ci` 构建、上传开发版本并生成预览二维码。

工作流配置：`.github/workflows/wechat-release.yml`。

## 日常开发与开发版

1. PR 指向 `main` 时，工作流安装依赖、运行 `npm test`、执行 `npm run build:mp-weixin`、校验 `dist/build/mp-weixin` 关键文件，并保存构建 Artifact（30 天）。PR 检查不读取微信上传密钥，也不上传开发版。
2. PR 合并到 `main` 后，若变更命中工作流的微信源码/构建路径，工作流会重新测试和构建，使用 `miniprogram-ci` 上传微信开发版，并生成预览二维码。纯文档、CI 配置变更不会自动触发 main push 上传。
3. 自动上传版本号取自 `package.json`，描述包含 main 提交短 SHA。常规开发不自动修改版本号；仅在明确版本管理需要时调整。
4. 上传成功后，二维码以 `wechat-preview-qr-<version>` Artifact 保存 7 天。打开成功的 GitHub Actions 运行记录下载该 Artifact，提供给微信扫码体验。上传或二维码步骤失败时，先修复/重跑并确认成功再交付。
5. 手动备用入口：GitHub Actions 的 **WeChat Mini Program** → **Run workflow**。输入 `version`（如 `1.4.0`）并将 `upload` 设为 true；只在明确需要手动重传时使用。

当前发布目录为 CLI 构建生成的 `dist/build/mp-weixin`。不要手工修改 `unpackage/` 或将其中历史产物用于上传。

## 本地构建与预览

```bash
npm install
npm test
npm run build:mp-weixin
```

本地上传/预览需要微信代码上传私钥及对应 AppID。私钥只允许通过安全路径或 GitHub Actions Secret 提供，不得提交到仓库、PR、Issue、日志或聊天。工作流使用 `WECHAT_PRIVATE_KEY` Secret，将临时密钥写入 runner 并在结束时删除。

## 安全与发布边界

- 普通 PR 不访问微信密钥；main push 上传和明确开启上传的手动 workflow 才使用该密钥。
- 开发上传只创建微信开发版本，不提交微信审核，也不正式上线。
- 微信审核及正式上线是独立步骤，需依照正式发布流程及其明确指令执行。
- CloudBase 后端部署是独立工作流。前端二维码不能替代云端部署/功能验证，详情见 [项目标准开发流程](development-workflow.md)。

## 依赖

工作流使用 `npm install`，因为当前仓库尚未提交 `package-lock.json`。提交并验证 lockfile 后，才可将 CI 安装命令切换为 `npm ci`。

## 正式发布流程

正式发布与自动开发流程分离。正式候选固定在 `release/<version>` 分支；只有收到明确的“准备正式发布 X.Y.Z”指令后，才创建对应的 `release-trigger/<version>` 触发分支。

Formal Release Preparation 工作流会检出冻结的 `release/<version>`，校验 `package.json` 与 `manifest.json` 版本一致，重新构建并保存 90 天候选 Artifact，再将同一候选上传为微信开发版本并生成保存 30 天的候选预览二维码。

该流程只准备正式候选，不提交微信审核，也不正式上线。最终线上发布必须收到独立的“正式上线 X.Y.Z”明确指令；不得用开发上传流程代替正式发布。
