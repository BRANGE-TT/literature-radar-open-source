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
| 上传文件 | PASSED | 远端仅包含 `appsscript` 与 `Code`，内容与本地完全一致。 |
| 触发器 | PASSED | 本次未调用任何创建、删除或修改触发器的函数。 |
| Script Properties 复制 | PASSED | 未读取或复制个人项目的任何 Script Properties。 |
| 首次 Google 授权 | PASSED | 已在新项目中完成首次运行授权；未请求或使用 Gmail 权限。 |
| 新项目属性配置 | BLOCKED | 已在项目设置中核对为未配置；未写入、未从个人项目复制，也未显示属性值。 |

首次同步前，远端只有默认 manifest。本地 manifest 与远端仅在 `executionApi`、`oauthScopes`、`timeZone` 三项存在预期差异；同步会新增 `Code`，不会删除远端脚本文件。

## 4. Script Properties 需求

| 属性 | 用途 | 是否需用户配置 |
|---|---|---|
| `OPENALEX_API_KEY` | OpenAlex 连通性、主动检索、来源指标和完整 dry run | 是 |
| `FEISHU_WEBHOOK` | 专用飞书开发测试群机器人 Webhook | 是 |
| `FEISHU_SIGN_SECRET` | 飞书机器人启用签名校验时使用 | 可选 |
| `PUSHED_PAPER_KEYS_V1` | 正式推送去重记录，由程序运行时维护 | 否；测试不得手工写入 |
| `OPENALEX_WORK_CACHE_V1_*` | OpenAlex work 缓存 | 否；运行时生成 |
| `OPENALEX_SOURCE_CACHE_V1_*` | OpenAlex source 缓存 | 否；运行时生成 |

未配置外部凭证时可以运行本地语法、manifest、静态分析和 Node 单元测试，也可离线验证日期范围、评分、OA-Q1 proxy、去重键和消息格式。OpenAlex 主动检索、有效 dry run 与飞书发送必须等待独立测试凭证。

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
| `testFeishuPushOnePaper()` | 发送单篇 mock 文献消息 | 否 | 是 | 否 | 是 |
| `testEveryTwoDaysFeishuPush()` | 发送主动检索格式的 mock 消息 | 否 | 是 | 否 | 是 |
| `testSetupEveryTwoDaysTrigger()` | 删除同名触发器并创建每两日触发器 | 否 | 否 | 否 | 否 |
| `runEveryTwoDaysOpenAlexPush()` | 正式完整流程入口 | 是 | 是 | 是 | 是 |

`testEveryTwoDaysDryRun()` 是现有安全 dry run：不发送飞书、不创建触发器、不写 `PUSHED_PAPER_KEYS_V1`。它会在当前新项目中维护 OpenAlex 缓存，不会访问个人项目存储。

现有飞书测试函数的标题和说明不完全符合本任务规定的 `Literature Radar Open Source Dev Test` 文案，因此在没有测试 Webhook 时未执行，也没有擅自修改业务代码或发送不合规测试消息。

## 6. 测试结果

| 测试项 | 状态 | 结果 |
|---|---|---|
| JavaScript / Apps Script 语法 | PASSED | `node --check` 通过。 |
| `appsscript.json` manifest | PASSED | JSON 解析与远端语义比对通过。 |
| 未定义函数 / 重复声明 | PASSED | ESLint `no-undef`、`no-redeclare` 无错误。 |
| 重复函数名 | PASSED | 检查 133 个函数，未发现重复。 |
| 配置字段与 Script Properties 名称 | PASSED | 属性常量与调用位置一致。 |
| 触发器入口 | PASSED | `runEveryTwoDaysOpenAlexPush()` 与 setup 入口存在；未执行 setup。 |
| 飞书推送函数 | PASSED | `postFeishuText_()` 存在；未发送消息。 |
| OpenAlex 主流程 | PASSED | 主流程与两方向检索入口存在。 |
| 本地 Node 单元测试 | PASSED | 24 项全部通过。 |
| 评分机制 | PASSED | 本地测试覆盖 relatedness、venue quality、citation、freshness、final score 与 OA-Q1 proxy。 |
| Apps Script 在线 mock 评分 | PASSED | 在新项目中执行 `testVenueQualityScoring()`，日志显示执行完毕；不依赖外部凭据，不发送消息、不写去重记录、不创建触发器。 |
| OpenAlex API 连通性 | BLOCKED | 新项目未配置 `OPENALEX_API_KEY`。 |
| 统计学方向主动检索 | BLOCKED | 新项目未配置 `OPENALEX_API_KEY`。 |
| 医学机器学习方向主动检索 | BLOCKED | 新项目未配置 `OPENALEX_API_KEY`。 |
| Apps Script dry run | BLOCKED | 有安全入口，但缺少 `OPENALEX_API_KEY`，未运行空结果测试。 |
| 飞书单条测试 | BLOCKED | 未配置并确认专用测试群 `FEISHU_WEBHOOK`；现有测试文案亦不满足指定标题。 |
| 完整流程人工测试 | BLOCKED | OpenAlex、dry run 和飞书前置条件未全部通过。 |
| 触发器测试 | NOT RUN | 本任务明确禁止创建正式定时触发器。 |

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

Google 登录与新项目首次 Apps Script 授权已在本次验证中完成。尚需：

1. 打开 `Literature Radar Open Source Dev` 的“项目设置”→“脚本属性”，添加开发者自己的 `OPENALEX_API_KEY`；不要从个人稳定版复制，也不要把值发到聊天或提交到 Git。
2. 在飞书创建专用开发测试群和自定义机器人，把该测试机器人的 Webhook 配置为新项目的 `FEISHU_WEBHOOK`。如果启用签名校验，再配置 `FEISHU_SIGN_SECRET`。
3. 完成后只需告知：`OPENALEX_API_KEY 已配置`、`FEISHU_WEBHOOK 已配置且确认属于开发测试群`、是否启用签名；不要提供完整值。

后续验证顺序应为：OpenAlex 连通性 → 两方向主动检索 → 评分输出 → 安全 dry run → 符合指定文案的单条飞书测试 → 一次受限完整流程测试。任何阶段都不得创建正式触发器。

## 9. 是否满足进入配置化重构阶段

**暂不满足。** 独立 GitHub 与 Apps Script 环境已经建立，安全与本地静态验证通过；但 OpenAlex、dry run、飞书和完整流程测试仍因独立测试凭证未配置而阻塞。本任务结束后不自动进入配置化重构。
