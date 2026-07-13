# 开源开发版独立运行验证报告

生成日期：2026-07-13

## 1. 环境信息

| 项目 | 结果 |
|---|---|
| 开源项目路径 | `C:\Users\xuzhipeng\Desktop\agent\literature-radar-open-source` |
| Git 分支 | `main` |
| GitHub 仓库 | `BRANGE-TT/literature-radar-open-source` |
| GitHub 可见性 | `PRIVATE` |
| Git remote（脱敏） | `git@github.com:BR****TT/literature-radar-open-source.git` |
| Git 上游 | `origin/main` |
| Apps Script 项目 | `Literature Radar Open Source Dev` |
| 新 Script ID（脱敏） | `1x0a****dDi-` |
| 个人 Script ID（仅取分离报告） | `1ejU****1gzX` |
| 新旧 Script ID 是否不同 | 是 |
| Node.js / npm | `v24.11.0` / `11.6.1` |
| clasp | `3.3.0`，通过 `npx @google/clasp` 调用 |
| gh CLI | `2.92.0`，已登录 |

GitHub 私人仓库已创建并完成普通首次推送。本地 `main`、`origin/main` 与 GitHub 远端 HEAD 已核对一致，没有使用 force push。

## 2. 安全检查

| 检查项 | 状态 | 说明 |
|---|---|---|
| 真实飞书 Webhook | PASSED | 当前文件与全部可达 Git 历史均未发现。 |
| 真实 OpenAlex API Key | PASSED | 仅存在属性名和动态请求参数构造。 |
| GitHub Token / Bearer 凭证 | PASSED | 未发现。 |
| 邮箱地址 | PASSED | 仅保留 Google Scholar Alert 公共服务发件地址；不是个人邮箱或凭证。 |
| `.clasp.json` | PASSED | 本地存在、已被 `.gitignore` 忽略、未被 Git 跟踪。 |
| 敏感文件、日志和个人缓存 | PASSED | 未发现 `.env`、凭证文件、Token 文件、日志或个人推送记录。 |
| `.gitignore` 完整性 | PASSED | 包含任务要求的全部忽略规则。 |
| Git 历史 | PASSED | 全部可达提交与提交元数据均已扫描；提交邮箱使用 GitHub noreply。 |
| GitHub 可见性 | PASSED | 新仓库保持 `PRIVATE`。 |

详细结果见 `SECURITY_SCAN_REPORT.md`。报告和 Git 历史中没有写入完整 Script ID、Webhook、API Key 或其他认证值。

## 3. Apps Script 验证

| 检查项 | 状态 | 说明 |
|---|---|---|
| 目标项目识别 | PASSED | Apps Script API 返回的项目名称与本地 Script ID 均匹配新项目。 |
| 首次 `clasp push` | PASSED | 使用标准交互式 `clasp push`，审查 manifest 差异后确认；未使用 `--force`。 |
| 本次增量同步 | PASSED | 标准 `clasp push` 因 Google OAuth 连接超时而未写入远端；随后通过 Apps Script 官方 `projects.updateContent` 接口仅同步 `Code` 与 `appsscript`，回读哈希与本地完全一致。 |
| 上传文件 | PASSED | 远端仅包含 `appsscript` 与 `Code`，内容与本地完全一致。 |
| 触发器 | PASSED | 本次未调用任何创建、删除或修改触发器的函数；新项目触发器页面显示没有符合条件的结果。 |
| Script Properties 复制 | PASSED | 未读取或复制个人项目的任何 Script Properties。 |
| 首次 Google 授权 | PASSED | 已在新项目中完成首次运行授权；未请求或使用 Gmail 权限。 |
| 新项目属性配置 | PASSED | `OPENALEX_API_KEY`、`FEISHU_WEBHOOK`、`FEISHU_SIGN_SECRET` 均已在新项目中配置；未从个人项目复制，报告中不记录属性值。 |

首次同步前，远端只有默认 manifest。本地 manifest 与远端仅在 `executionApi`、`oauthScopes`、`timeZone` 三项存在预期差异；同步会新增 `Code`，不会删除远端脚本文件。

本次新增专用飞书测试函数后，先只读确认远端仍恰好包含两个文件，再执行全量内容更新；更新后再次读取远端，两个文件的 SHA-256 均与本地一致。未使用 `clasp push --force`。

## 4. Script Properties 需求

| 属性 | 用途 | 当前状态 |
|---|---|---|
| `OPENALEX_API_KEY` | OpenAlex 连通性、主动检索、来源指标和完整 dry run | 已配置 |
| `FEISHU_WEBHOOK` | 专用飞书开发测试群机器人 Webhook | 已配置；用户确认属于开发测试群 |
| `FEISHU_SIGN_SECRET` | 飞书机器人签名校验 | 已配置；签名已启用 |
| `PUSHED_PAPER_KEYS_V1` | 正式推送去重记录，由程序运行时维护 | 未手工配置；本次测试未写入 |
| `OPENALEX_WORK_CACHE_V1_*` | OpenAlex work 缓存 | 由新项目运行时维护 |
| `OPENALEX_SOURCE_CACHE_V1_*` | OpenAlex source 缓存 | 由新项目运行时维护 |

三个外部属性均只存在于新 Apps Script 项目的 Script Properties 中；本地源码、报告和 Git 历史不包含其值。OpenAlex 测试只使用新项目属性，飞书测试只使用用户确认的专用开发测试群 Webhook。

## 5. 实际测试函数清单

| 函数名 | 用途 | 依赖 OpenAlex Key | 依赖飞书 Webhook | 写入正式去重记录 | 发送消息 |
|---|---|---:|---:|---:|---:|
| `testOpenAlexSearchByTitle()` | 按标题查询 OpenAlex work | 是 | 否 | 否 | 否 |
| `testOpenAlexSourceMetrics()` | 查询固定 OpenAlex source 指标 | 是 | 否 | 否（会写新项目缓存） | 否 |
| `testVenueQualityScoring()` | 使用 mock 数据验证 venue quality 与 OA-Q1 proxy | 否 | 否 | 否 | 否 |
| `testDailyPushDryRun()` | Gmail 补充流程 dry run | 完整评分需要 | 否 | 否 | 否 |
| `testOpenAlexActiveSearchStatistics()` | 生存分析方向主动检索 | 是 | 否 | 否（会写新项目缓存） | 否 |
| `testOpenAlexActiveSearchMedicalML()` | 医学机器学习方向主动检索 | 是 | 否 | 否（会写新项目缓存） | 否 |
| `testFiveYearDateRange()` | 输出动态近五年日期范围 | 否 | 否 | 否 | 否 |
| `testEveryTwoDaysDryRun()` | 两方向主动检索、评分与最终候选预览 | 是 | 否 | 否（会写新项目缓存） | 否 |
| `testFeishuPush()` | 发送基础飞书测试消息 | 否 | 是 | 否 | 是 |
| `testOpenSourceDevFeishuPush()` | 发送一条符合本任务指定标题和说明的开发环境测试消息 | 否 | 是 | 否 | 是 |
| `testFeishuPushOnePaper()` | 发送单篇 mock 文献消息 | 否 | 是 | 否 | 是 |
| `testEveryTwoDaysFeishuPush()` | 发送主动检索格式的 mock 消息 | 否 | 是 | 否 | 是 |
| `testSetupEveryTwoDaysTrigger()` | 删除同名触发器并创建每两日触发器 | 否 | 否 | 否 | 否 |
| `runEveryTwoDaysOpenAlexPush()` | 正式完整流程入口 | 是 | 是 | 是 | 是 |

`testEveryTwoDaysDryRun()` 是现有安全 dry run：不发送飞书、不创建触发器、不写 `PUSHED_PAPER_KEYS_V1`。它会在当前新项目中维护 OpenAlex 缓存，不会访问个人项目存储。

原有飞书测试函数的标题和说明不完全符合本任务规定，因此新增最小独立入口 `testOpenSourceDevFeishuPush()`。该函数只调用现有 `postFeishuText_()` 一次，不访问 OpenAlex 或 Gmail，不创建触发器，也不读写正式去重记录。

## 6. 测试结果

| 测试项 | 状态 | 结果 |
|---|---|---|
| JavaScript / Apps Script 语法 | PASSED | `node --check` 通过。 |
| `appsscript.json` manifest | PASSED | JSON 解析与远端语义比对通过。 |
| 未定义函数 / 重复声明 | PASSED | ESLint `no-undef`、`no-redeclare` 无错误。 |
| 重复函数名 | PASSED | 检查 134 个函数，未发现重复。 |
| 配置字段与 Script Properties 名称 | PASSED | 属性常量与调用位置一致。 |
| 触发器入口 | PASSED | `runEveryTwoDaysOpenAlexPush()` 与 setup 入口存在；未执行 setup。 |
| 飞书推送函数 | PASSED | `postFeishuText_()` 及专用测试入口存在；签名测试仅发送一次。 |
| OpenAlex 主流程 | PASSED | 主流程与两方向检索入口存在。 |
| 本地 Node 单元测试 | PASSED | 24 项全部通过。 |
| 评分机制 | PASSED | 本地测试覆盖 relatedness、venue quality、citation、freshness、final score 与 OA-Q1 proxy。 |
| Apps Script 在线 mock 评分 | PASSED | 在新项目中执行 `testVenueQualityScoring()`，日志显示执行完毕；不依赖外部凭据，不发送消息、不写去重记录、不创建触发器。 |
| OpenAlex API 连通性 | PASSED | 在新项目执行 `testOpenAlexSearchByTitle()`；返回并解析 OpenAlex work JSON，执行完毕，日志未输出完整 API Key。 |
| 统计学方向主动检索 | PASSED | 执行 `testOpenAlexActiveSearchStatistics()` 并返回候选数组；dry run 中该方向得到 73 个候选。 |
| 医学机器学习方向主动检索 | PASSED | 执行 `testOpenAlexActiveSearchMedicalML()` 并返回候选数组；dry run 中该方向得到 69 个候选。 |
| Apps Script dry run | PASSED | `testEveryTwoDaysDryRun()` 共解析 142 个候选，两个方向各输出 1 个最终候选及 relatedness、venue quality、citation、freshness、final score 和 OA-Q1 proxy；未发送消息、未创建触发器、未写正式去重记录。 |
| 飞书单条测试 | PASSED | 仅执行一次 `testOpenSourceDevFeishuPush()`；指定标题与三条说明完整，Apps Script 日志为“已开始执行 → 执行完毕”，未出现 HTTP 或飞书非零状态错误。 |
| 完整流程人工测试 | NOT RUN | 现有真实完整流程入口会写正式去重记录，且消息未明确标注开发测试；没有同时满足本任务约束的现有入口，因此未冒险执行，也未扩展为功能重构。 |
| 触发器测试 | NOT RUN | 本任务明确禁止创建正式定时触发器；只读页面确认当前没有触发器。 |

## 7. 个人稳定版保护结果

| 检查项 | 状态 | 说明 |
|---|---|---|
| 个人项目目录 | PASSED | 目录仍存在。 |
| 个人 GitHub 仓库 | PASSED | 原仓库仍为 `PRIVATE`。 |
| 稳定 Tag | PASSED | 远端 `personal-stable-v1` 仍存在。 |
| 个人 Git remote | PASSED | 本次所有 Git 命令均以开源目录为工作目录；未读取或修改个人 `.git/config`。 |
| 个人 Script ID | PASSED | 未读取或修改个人 `.clasp.json`；仅使用分离报告中的脱敏基线比较。 |
| 个人 `clasp push` | PASSED | 未执行。 |
| 个人触发器 | PASSED | 未调用任何针对个人项目的触发器操作。 |
| 个人 Script Properties | PASSED | 未读取、复制或修改。 |
| 个人正式飞书 Webhook | PASSED | 未读取、复制或使用。 |

## 8. 尚需用户手动完成的事项

Google 登录、首次 Apps Script 授权、三个 Script Properties、OpenAlex 测试和签名飞书测试均已完成。仅需用户在专用测试群中目视确认：

1. 只收到 1 条标题为 `Literature Radar Open Source Dev Test` 的消息；
2. 三行中文说明无乱码、无截断；
3. 本条纯文本连通性消息未包含链接，因此“链接是否正常”不适用。

如果测试群没有收到消息，请先反馈执行时间附近的群机器人提示，不要直接重复运行，以免产生重复消息。

## 9. 是否满足进入配置化重构阶段

**不进入。** 独立 GitHub、Apps Script、Script Properties、OpenAlex、评分、dry run 和单条签名飞书测试已经完成；受限完整流程因没有符合全部安全约束的现有入口而保持 `NOT RUN`。本任务是独立运行验证，不自动进入配置化或功能重构。
