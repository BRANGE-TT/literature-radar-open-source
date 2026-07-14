# Repository Isolation Report

生成日期：2026-07-13；公开发布复核：2026-07-14

## 结论

本仓库由独立工作区创建，未继承个人稳定版仓库的 Git 历史、remote、Apps Script 绑定、Script Properties、触发器或推送记录。个人稳定版项目不属于本仓库的运行或发布边界。

## 隔离边界

| 项目 | 本仓库策略 |
| --- | --- |
| Git | 独立历史与 `origin`；不记录个人仓库 remote |
| Apps Script | 每位使用者创建自己的 standalone 项目 |
| `.clasp.json` | 仅保存在本地并由 `.gitignore` 排除 |
| `.clasprc.json` | OAuth refresh token 文件，由 `.gitignore` 排除 |
| Script Properties | 由使用者在自己的 Apps Script 项目中配置 |
| 飞书 | 每位使用者配置自己的测试或正式群机器人 |
| 去重与缓存 | 保存在使用者项目的 Script Properties 中，不进入 Git |
| 触发器 | 由使用者在自己的项目中显式创建 |

## 纳入仓库的内容

- `Code.gs` 与 `appsscript.json`；
- 本地离线测试；
- 不含凭证的配置示例；
- README、贡献指南、安全策略和设计文档；
- GitHub Actions 回归检查。

以下内容不得进入仓库：真实 Webhook、API Key、OAuth Token、`.clasp.json`、`.clasprc.json`、Script Properties 导出、执行日志、缓存、推送历史和个人数据。

## 发布注意事项

当前文件不再记录本机绝对路径、其他仓库名称或任何 Script ID。较早的验证提交包含非机密的本地环境元数据；公开仓库前应由所有者决定保留现有历史还是另行批准历史整理。未经明确授权不得 rewrite history 或 force push。

公开发布前继续执行 [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md)，尤其是许可证选择、全新项目安装验证、历史隐私复核和最终凭证扫描。
