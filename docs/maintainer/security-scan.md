# Security Scan Report

扫描日期：2026-07-15

## 范围

- 当前工作树中的 tracked 与待提交文件；
- `main` 全部可达 Git 历史；
- Git 提交作者与提交者邮箱；
- 敏感文件跟踪状态与 `.gitignore`；
- 用户配置示例、CI、README 和维护文档。

## 结果

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 飞书 Webhook | PASSED | 未发现真实 Webhook URL |
| OpenAI/GitHub/Google Token | PASSED | 当前树与可达历史未命中凭证模式 |
| OpenAlex API Key | PASSED | 仅存在属性名和占位说明，未保存 Key 值 |
| Apps Script 凭证 | PASSED | `.clasp.json`、`.clasprc.json` 未被跟踪且已忽略 |
| `.env` 与凭证文件 | PASSED | `.env`、`credentials.json`、`token.json` 未被跟踪且已忽略 |
| 配置示例 | PASSED | v2 与旧版示例只包含研究方向和筛选字段，不含凭证或个人数据 |
| Git 元数据 | PASSED | 可达提交使用 GitHub noreply 邮箱 |
| 运行日志与缓存 | PASSED | 未跟踪执行日志、推送历史或 Apps Script 缓存 |

## 隐私说明

已复核全部可达历史。三个早期提交仍包含非机密的本机目录、两个截断 Script ID 和一个开发 Script ID 的 SHA-256 指纹；未发现完整 Script ID 或认证凭证。上述元数据判定为低风险并接受保留，不为此 rewrite history 或 force push。

## 发布判定

未发现需要轮换的已提交凭证。当前代码安全扫描为 **PASSED**，但仓库在以下事项完成前仍不应改为 Public：

1. 所有者明确确认公开。

GitHub Private Vulnerability Reporting 只对 Public 仓库开放；可见性切换后应立即启用并验证报告入口。

详细发布门禁见 [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md)。
