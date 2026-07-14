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
| `runOpenSourceDevFullFlowTest()` | 手动开发完整流程 | 是 | 是 | 否；只写开发测试记录 | 是 |
| `runOpenSourceDevScheduledTest()` | 开发触发器执行入口 | 是 | 是 | 否；只写开发测试记录 | 是 |
| `listOpenSourceDevTriggers()` | 只读列出并标记开发触发器 | 否 | 否 | 否 | 否 |
| `setupOpenSourceDevTrigger()` | 仅替换开发 handler 的每两日触发器 | 否 | 否 | 否 | 否 |
| `removeOpenSourceDevTrigger()` | 仅删除开发 handler 的触发器 | 否 | 否 | 否 | 否 |

`testEveryTwoDaysDryRun()` 是现有安全 dry run：不发送飞书、不创建触发器、不写 `PUSHED_PAPER_KEYS_V1`。它会在当前新项目中维护 OpenAlex 缓存，不会访问个人项目存储。

原有飞书测试函数的标题和说明不完全符合本任务规定，因此新增最小独立入口 `testOpenSourceDevFeishuPush()`。该函数只调用现有 `postFeishuText_()` 一次，不访问 OpenAlex 或 Gmail，不创建触发器，也不读写正式去重记录。

## 6. 测试结果

| 测试项 | 状态 | 结果 |
|---|---|---|
| JavaScript / Apps Script 语法 | PASSED | `node --check` 通过。 |
| `appsscript.json` manifest | PASSED | JSON 解析与远端语义比对通过。 |
| 未定义函数 / 重复声明 | PASSED | ESLint `no-undef`、`no-redeclare` 无错误。 |
| 重复函数名 | PASSED | 检查 153 个函数，未发现重复。 |
| 配置字段与 Script Properties 名称 | PASSED | 属性常量与调用位置一致。 |
| 触发器入口 | PASSED | `runEveryTwoDaysOpenAlexPush()` 与 setup 入口存在；未执行 setup。 |
| 飞书推送函数 | PASSED | `postFeishuText_()` 及专用测试入口存在；签名测试仅发送一次。 |
| OpenAlex 主流程 | PASSED | 主流程与两方向检索入口存在。 |
| 本地 Node 单元测试 | PASSED | 当前 28 项全部通过；新增 4 项覆盖开发消息标识、项目边界、去重隔离和触发器管理。 |
| 评分机制 | PASSED | 本地测试覆盖 relatedness、venue quality、citation、freshness、final score 与 OA-Q1 proxy。 |
| Apps Script 在线 mock 评分 | PASSED | 在新项目中执行 `testVenueQualityScoring()`，日志显示执行完毕；不依赖外部凭据，不发送消息、不写去重记录、不创建触发器。 |
| OpenAlex API 连通性 | PASSED | 在新项目执行 `testOpenAlexSearchByTitle()`；返回并解析 OpenAlex work JSON，执行完毕，日志未输出完整 API Key。 |
| 统计学方向主动检索 | PASSED | 执行 `testOpenAlexActiveSearchStatistics()` 并返回候选数组；dry run 中该方向得到 73 个候选。 |
| 医学机器学习方向主动检索 | PASSED | 执行 `testOpenAlexActiveSearchMedicalML()` 并返回候选数组；dry run 中该方向得到 69 个候选。 |
| Apps Script dry run | PASSED | `testEveryTwoDaysDryRun()` 共解析 142 个候选，两个方向各输出 1 个最终候选及 relatedness、venue quality、citation、freshness、final score 和 OA-Q1 proxy；未发送消息、未创建触发器、未写正式去重记录。 |
| 飞书单条测试 | PASSED | 仅执行一次 `testOpenSourceDevFeishuPush()`；指定标题与三条说明完整，Apps Script 日志为“已开始执行 → 执行完毕”，未出现 HTTP 或飞书非零状态错误。 |
| 完整流程人工测试 | PASSED | 用户在 Apps Script 编辑器中手动执行一次；运行时项目检查通过，两个方向均返回 HTTP 200、飞书状态码 0，并写入独立开发测试去重记录。飞书截图确认双方向内容完整。 |
| 触发器测试 | PASSED / CREATED | 用户在停止点 4 明确确认后，于 Apps Script 编辑器执行创建函数；日志确认开发 handler、每两日、Asia/Shanghai、约 07:30，随后只读列表确认当前仅 1 个开发触发器。 |

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

用户已于 2026-07-14 根据飞书开发测试群截图完成人工确认：

1. 收到 1 条标题为 `Literature Radar Open Source Dev Test` 的消息；
2. 中英文完整，无乱码、截断或布局异常；
3. 消息明确标注为开发测试；
4. 消息只出现在开发测试群，未发送到个人正式推送群；
5. 本条纯文本连通性消息未包含链接，因此链接检查不适用。

用户随后于 2026-07-14 根据执行日志和开发测试群截图完成双方向完整流程确认：

1. `runMode` 为 `manual`，运行时开发项目边界检查通过，未输出 Script ID 或凭证；
2. 共解析 142 个候选，生存分析与医学机器学习交叉方向各输出 1 篇；
3. 两个方向均返回 HTTP 200、飞书状态码 0，且 `devTestDedupWritten` 为 `true`；
4. 消息标题、开发环境说明、作者、来源、日期、DOI、评分及 OA-Q1 proxy 声明完整；
5. 两个 DOI 链接均显示为可点击状态，截图未见乱码、截断或消息错位。

用户明确要求不等待未来窗口后，于 2026-07-14 20:47 人工执行实际定时 handler `runOpenSourceDevScheduledTest()` 完成等价验证：

1. 日志中的 `runMode` 为 `scheduled`，运行时开发环境检查通过；
2. 生存分析方向选择 JAMA 文献，Final Score 为 0.72；
3. 医学与机器学习交叉方向选择 Scientific Reports 文献，Final Score 为 0.78；
4. 两个方向均返回 HTTP 200、飞书状态码 0，且 `devTestDedupWritten` 为 `true`；
5. 20:55 再次执行只读列表，仍仅有 1 个 `CLOCK` 类型开发触发器。

## 9. 是否满足进入配置化重构阶段

**仍不进入。** 独立 GitHub、Apps Script、Script Properties、OpenAlex、评分、dry run、单条签名飞书测试、开发完整流程和开发触发器创建均已通过；当前仅等待首次自动运行观察。本任务不自动进入配置化或功能重构。

## 10. 开发完整流程与触发器准备状态

更新日期：2026-07-14

| 检查项 | 状态 | 结果 |
|---|---|---|
| 正式主流程安全审计 | PASSED | 正式入口发送成功后才写正式去重记录，不创建触发器，也不输出凭证；但缺少开发标识、开发项目校验和独立测试去重，因此未直接用于开发完整流程。 |
| Apps Script 增量同步 | PASSED | 用户确认停止点 2 后，仅同步 `Code` 与 `appsscript`；远端回读哈希与本地一致，未使用 `--force`。 |
| 开发完整流程入口 | PASSED | 用户在 Apps Script 编辑器中手动执行 `runOpenSourceDevFullFlowTest()` 一次；两个方向各选出一篇并成功发送。此前失败的自动化 OAuth 登录未被绕过。 |
| 开发项目边界 | PASSED | 运行时项目检查通过；日志明确未输出 Script ID 或凭证。 |
| 开发测试去重 | PASSED | 两个方向日志均显示 `devTestDedupWritten: true`；使用独立属性 `DEV_TEST_SENT_PAPER_KEYS_V1`，不写正式去重记录。 |
| 飞书开发标识 | PASSED | 截图确认消息包含 `Literature Radar Open Source Dev Test` 和“不是正式推荐任务”说明。 |
| 开发触发器管理 | PASSED / CREATED | 创建日志显示 handler 为 `runOpenSourceDevScheduledTest`、每 2 天、Asia/Shanghai、约 07:30，`replacedExistingCount` 为 0；只读列表仅返回 1 个 `CLOCK` 类型开发触发器。 |
| 等价人工触发验证 | PASSED | 人工执行实际定时 handler 一次，日志为 `runMode: scheduled`；两个方向均返回 HTTP 200、飞书状态码 0，并写入独立开发去重。验证后触发器仍为 1 个。 |
| 自动触发观察 | PENDING OBSERVATION | 触发器已创建，但尚未到达并核验首次实际自动运行窗口；不得提前声称自动运行通过。 |
| GitHub 可见性 | PRIVATE | 本阶段不得公开仓库。 |
| 配置化重构 | NOT STARTED | 本阶段不进入配置化重构。 |

停止点 4、触发器创建核验与等价人工触发验证均已完成。真实时钟事件仍为 `PENDING OBSERVATION`。Apps Script 不公开首次运行日期；从下一个 Asia/Shanghai 早间窗口开始检查，`nearMinute(30)` 的官方语义为约 07:30、前后最多 15 分钟。首次真实自动运行后仍需核对执行日志、双方向消息和开发去重行为。
