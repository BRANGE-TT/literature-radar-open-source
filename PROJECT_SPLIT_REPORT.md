# Personal / Open-Source Project Split Report

生成日期：2026-07-13

## 执行结论

个人稳定版与开源开发版已在本地目录、Git 历史、Git remote、Apps Script ID 和凭证边界上完成隔离。个人项目未执行 `clasp push`，未修改 Script ID、Script Properties 或触发器；开源项目未执行 `clasp push`，未配置 Script Properties，也未创建触发器或 GitHub 仓库。

## 项目状态

| 项目 | 个人稳定版 | 开源开发版 |
| --- | --- | --- |
| 本地路径 | `C:\Users\xuzhipeng\Desktop\agent\自动推送文献` | `C:\Users\xuzhipeng\Desktop\agent\literature-radar-open-source` |
| Git 仓库 | 现有私人 GitHub 仓库 `BRANGE-TT/scholar-alert-feishu-push` | 新建本地 Git 仓库 |
| Git 分支 | `feature/openalex-oa-q1-proxy` | `main` |
| Git remote | 原 `origin`，未变更 | 未配置 |
| GitHub 可见性 | `PRIVATE`，未变更 | 尚未创建 GitHub 仓库 |
| 稳定快照 | 提交 `fb88e88ede1cb767ca1e6bbe8afd750166d8b556`；Tag `personal-stable-v1` 已推送 | 首次提交 `3f3fbfe2fd637ef7abbd97da8c6b12911b7ea113` |
| Apps Script | 原 Script ID `1ejU****1gzX` | 新 standalone Script ID `1x0a****dDi-` |
| Script Properties | 原正式配置未修改 | 未复制、未配置 |
| 触发器 | 未执行删除或修改操作 | 未创建 |

新旧 Apps Script ID 已比较并确认不同。新项目的 `.clasp.json` 由 `clasp create` 生成，只保留在本地并由 `.gitignore` 排除。

## 复制范围

仅复制了继续开发所需的非敏感文件：

- `Code.gs`
- `appsscript.json`
- `.claspignore`
- `README.md`
- `docs/openalex-oa-q1-proxy-design.md`
- `tests/openalex_quality.test.js`

新项目另行创建了 `.gitignore` 和只含占位符的 `.clasp.json.example`。

以下内容未复制：

- 原 `.git/`：避免继承私人仓库历史和 remote。
- 原 `.clasp.json`：避免继承个人 Apps Script ID。
- 原 `.gitignore`：新项目按开源隔离要求重新创建。
- `.env`、`credentials.json`、`token.json`、Webhook/API Key 配置：不得复制真实凭证；源目录检查中也未发现这些文件。
- 日志、缓存、已推送记录、本地临时文件、`node_modules/`、`build/`、`dist/` 和操作系统文件：属于运行状态或可再生内容，不应进入新项目。
- 已在个人项目快照前由现有工作区删除的两个 `docs/superpowers/plans/` 计划文档：当前稳定工作树已不包含它们。

## 安全检查

- 当前工作树、HEAD 和可达 Git 历史扫描未发现真实飞书 Webhook、OpenAlex API Key 或 GitHub Token。
- 原 `.clasp.json` 在私人仓库中被跟踪并包含原 Script ID；Script ID 不是授权凭证，但该文件没有复制到开源项目。
- 代码和 README 中存在 Google Scholar Alert 的公共服务发件地址；它不是个人邮箱或凭证，属于保留的可选业务流程。
- 新项目未发现原 Script ID、真实 Webhook、真实 API Key 或 GitHub Token。
- 新项目没有 Git remote，没有发布到 GitHub，也没有执行任何 Git push。
- 本次未对任何 Apps Script 项目执行 `clasp push`。

## 验证结果

### 个人稳定版

- 原目录、原 remote 和原 Script ID 均保持不变。
- 业务源码没有被新项目覆盖。
- 稳定提交与 `personal-stable-v1` Tag 已推送到原私人仓库。
- GitHub 仓库仍为 `PRIVATE`。
- 未调用任何删除或重建个人触发器的函数，也未执行会修改 Apps Script 的命令，因此原触发器未被本次任务改动。

### 开源开发版

- 使用全新 Git 历史，且没有 remote。
- 没有复制原 `.git/` 或原 `.clasp.json`。
- 新 `.clasp.json` 绑定不同的 standalone Apps Script 项目，并被 Git 忽略。
- 未配置真实 Webhook、API Key、Script Properties 或正式定时触发器。
- 未发布到公共 GitHub 仓库。

## 尚未执行及后续手动操作

本次隔离本身没有待补的手动步骤。按照任务边界，以下事项有意保留到后续：

1. 使用专门的开发/测试飞书 Webhook 和开发者自己的 OpenAlex API Key 配置新项目 Script Properties。
2. 再次核对新 Script ID 后，首次执行 `clasp push`。
3. 在测试凭证验证通过后，再决定是否创建开发用触发器。
4. 另行创建新的 GitHub 仓库并决定公开时机；不得使用个人项目的 remote。

## 下一步建议：配置化重构

下一项任务可只处理配置边界：整理可由开发者设置的检索主题、时区、运行频率和推送凭证，统一通过明确的非敏感默认值与 Script Properties 读取，并补充缺失配置的测试和 README。该任务应继续保持评分、OA-Q1 proxy、OpenAlex 检索和飞书消息业务逻辑不变。
