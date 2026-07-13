# 开源开发版安全扫描报告

扫描日期：2026-07-13

## 扫描范围

- 当前工作树中的项目文件（含本次新增测试入口与验证报告）；
- `main` 分支全部可达 Git 提交；
- Git 提交作者与提交者邮箱类型；
- `.gitignore` 与敏感文件跟踪状态。

## 扫描结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| 飞书 Webhook | PASSED | 未发现真实 Webhook；仅存在属性名与文档说明。 |
| OpenAlex API Key | PASSED | 未发现真实 API Key；仅存在属性名与动态请求参数构造。 |
| 新项目 Script Properties 值 | PASSED | 只保存在新 Apps Script 项目中，未写入本地文件、报告或 Git 历史。 |
| GitHub Token / Bearer 凭证 | PASSED | 当前文件与可达 Git 历史均未发现。 |
| 邮箱地址 | PASSED | 仅发现 Google Scholar Alert 公共服务发件地址；不是个人邮箱或凭证，无需处理。 |
| Apps Script ID | PASSED | 新 Script ID 仅存在于本地 `.clasp.json`，该文件已忽略且未被跟踪。 |
| 敏感文件与日志 | PASSED | 未发现 `.env`、凭证文件、Token 文件、日志或个人缓存记录。 |
| Git 提交元数据 | PASSED | 提交身份使用 GitHub noreply 地址。 |
| `.gitignore` 完整性 | PASSED | 已包含任务要求的全部忽略规则。 |

## 处置记录

- 复核 Gmail 检索地址为 Google Scholar Alert 公共服务发件地址，保留该可选业务流程；
- 扫描全部可达 Git 历史，未发现个人邮箱或认证凭证；
- OpenAlex 与飞书在线执行日志未复制到项目文件，报告仅记录脱敏结论；
- 未修改检索算法、评分权重、OA-Q1 proxy 或个人稳定版项目。

## 推送判定

未发现阻止创建或推送 GitHub 私人仓库的真实凭证。安全扫描结论：**PASSED**。
