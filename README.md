# OpenAlex 文献推荐飞书推送

这个项目用于在 Google Apps Script 中自动推荐英文文献，并通过飞书自定义机器人推送到群聊。

> 当前目录是与个人稳定版完全隔离的开源开发版。仓库不包含真实 Script ID、Script Properties、API Key、飞书 Webhook 或定时触发器；开发者应只使用自己的独立 Apps Script 项目和测试凭证。

当前主流程是：每两天早上约 7:30（`Asia/Shanghai`），主动调用 OpenAlex Works API 检索近五年英文文献，每次推送两篇：

- 生存分析领域：`survival analysis`、`time-to-event`、`Cox`、`competing risks`、`Kaplan-Meier`、`restricted mean survival time`、`multi-state model`、`censored data`、`RMTL` 等主题，筛选 1 篇。
- 医学与机器学习交叉方向：`medical machine learning`、`clinical machine learning`、`AI in medicine` 等主题，筛选 1 篇。

原来的 Google Scholar Alert + Gmail 读取流程仍然保留，但现在定位为可选补充流程。
推荐结果发送到飞书群，当前主流程不会把文献发送到 Gmail。

## 文件说明

- `Code.gs`：完整 Google Apps Script 脚本。
- `appsscript.json`：Apps Script manifest，包含运行时、时区和授权范围。
- `tests/openalex_quality.test.js`：本地 Node.js 测试，覆盖 OpenAlex 主动检索、OA-Q1 proxy、评分、去重和消息格式。
- `docs/openalex-oa-q1-proxy-design.md`：OpenAlex OA-Q1 proxy 设计文档。

## 主流程

1. `runEveryTwoDaysOpenAlexPush()` 获取 `OPENALEX_API_KEY`。
2. 每个方向分别构造 OpenAlex Works 查询。
3. 查询近五年英文文献，每个方向最多拉取 `75` 篇候选。
4. 标准化 OpenAlex work 为统一 paper 结构，包括标题、作者、来源、链接、DOI、摘要、发表日期、引用数等。
5. 过滤非英文、已撤稿、超出近五年范围、已推送、标题为空和明显非论文类型的候选；`dataset` 不进入论文推荐池。
6. 对关键词命中的候选补查完整 OpenAlex Source 指标；同一来源只请求一次，每个方向最多补查 `20` 个唯一来源。
7. 在同一方向内部计算关键词相关度、来源质量、引用分位、新鲜度。
8. 继续使用 OpenAlex 复合指标标记 `OA-Q1 proxy`。
9. 优先选择 `OA_Q1_PROXY == true` 的论文；否则选择 `final_score` 最高者。
10. 通过飞书 Webhook 推送。
11. 推送成功后用 `PropertiesService` 保存 DOI、OpenAlex work ID 或标题哈希，避免重复。

## 为什么改成 OpenAlex 主动检索

Google Scholar Alert 依赖邮件到达，容易受 Alert 关键词、邮件频率和 Gmail 解析影响。OpenAlex 主动检索可以稳定覆盖近五年英文文献，并且直接拿到结构化字段、引用数、来源指标和 DOI，更适合每两天做一次高质量候选筛选。

Scholar Alert 仍可用作补充：`runDailyScholarPush()` 会读取 Gmail 中的 Scholar Alert 邮件，并尽量使用 OpenAlex enrichment 补充质量指标。

注意：为了让当前 OpenAlex 主流程更容易授权，默认 `appsscript.json` 不再声明 Gmail 全权限 scope。若以后要重新启用 Gmail Scholar Alert 补充流程，需要把 `https://mail.google.com/` 加回 `oauthScopes`，并重新完成 Google 授权。

## Script Properties 配置

不要把 Webhook 或 API Key 写进代码。请在 Apps Script 的“项目设置 -> 脚本属性”中配置：

| 属性名 | 用途 |
| --- | --- |
| `FEISHU_WEBHOOK` | 飞书自定义机器人 Webhook |
| `FEISHU_SIGN_SECRET` | 飞书机器人签名密钥，没有启用签名校验可不填 |
| `OPENALEX_API_KEY` | OpenAlex API Key，主动检索主流程需要 |

`runEveryTwoDaysOpenAlexPush()` 如果没有找到 `OPENALEX_API_KEY`，会记录日志并停止主动检索流程，不会崩溃。

## OpenAlex 请求与缓存控制

- 每个方向先拉取最多 `75` 篇 Works 候选。
- 方向关键词使用 `title_and_abstract.search` 检索标题与摘要，并按最多 `6` 个一组拆分，避免全文噪声和 OpenAlex 宽布尔搜索的每秒一次限流；结果合并去重后仍最多保留 `75` 篇。
- 只为关键词确实命中的候选补查完整 Source 指标。
- 同一个 OpenAlex source 在一次执行中只请求一次。
- 每个方向最多补查 `20` 个唯一来源，优先处理关键词匹配度更高的候选。
- work/source 指标使用 Script Properties 缓存 `30` 天。
- 每次主流程运行前会清理过期、损坏和超量缓存，最多保留 `300` 条。
- 单个来源指标查询失败时保留论文，并在 Note 中说明已使用降级评分。
- 收到 HTTP 429 时按响应中的 `retryAfter` 等待并重试一次，最长等待 `5` 秒。

## 筛选公式

方向内来源质量分：

```text
venue_quality_score = 0.60 * P_2yr + 0.30 * P_h + 0.10 * P_i10
```

主动检索最终分：

```text
final_score = 0.45 * relatedness_score_norm
            + 0.35 * venue_quality_score
            + 0.15 * citation_score
            + 0.05 * freshness_score
```

其中：

- `relatedness_score_norm`：标题、摘要和来源中的关键词匹配分归一化。
- `venue_quality_score`：OpenAlex source 指标在同方向候选内部的百分位复合分。
- `citation_score`：OpenAlex `cited_by_count` 在同方向候选内部的百分位分。
- `freshness_score`：发表日期在近五年窗口中的新鲜度分。

## OA-Q1 proxy 说明

`OA-Q1 proxy` 是 OpenAlex-based venue quality proxy，不是正式 JCR Q1。

它基于 OpenAlex source 指标、方向内百分位和高质量来源白名单，用来帮助排序。推送消息中会固定说明：

```text
OA-Q1 proxy is based on OpenAlex metrics and is not official JCR quartile.
```

## Apps Script 中如何运行

1. 打开 Google Apps Script 项目。
2. 将 `Code.gs` 内容粘贴到编辑器。
3. 在项目设置中添加脚本属性 `FEISHU_WEBHOOK` 和 `OPENALEX_API_KEY`。
4. 先运行 `testOpenAlexActiveSearchStatistics()` 和 `testOpenAlexActiveSearchMedicalML()`，查看日志中是否能取到候选。
5. 运行 `testEveryTwoDaysDryRun()`，只预览最终推送文本，不发送飞书、不写入去重记录。
6. 确认无误后运行 `testEveryTwoDaysFeishuPush()`，发送一条模拟文献测试消息。
7. 最后运行 `setupEveryTwoDaysTrigger()`，创建每两日早上约 7:30 的触发器。

## 使用 clasp 连接独立项目

`.clasp.json` 是本地文件且已被 Git 忽略，不得使用个人稳定版的 Script ID。完成 `clasp login` 后，可以创建自己的 standalone Apps Script 项目：

```powershell
npx @google/clasp create --title "Literature Radar Open Source Dev" --type standalone --rootDir .
```

也可以复制 `.clasp.json.example`，把 `YOUR_NEW_APPS_SCRIPT_ID` 替换为自己的独立 Script ID。确认 ID 后再运行 `npx @google/clasp push`；该命令只同步 `Code.gs` 和 `appsscript.json`，不会复制脚本属性或触发器。凭证仍需由开发者在自己的 Apps Script 脚本属性中维护。

## 主要测试函数

- `testOpenAlexActiveSearchStatistics()`：测试生存分析领域主动检索。
- `testOpenAlexActiveSearchMedicalML()`：测试医学机器学习方向主动检索。
- `testFiveYearDateRange()`：查看动态近五年日期范围。
- `testEveryTwoDaysDryRun()`：完整 dry run，不推送、不写入去重。
- `testEveryTwoDaysFeishuPush()`：发送一条主动检索格式的模拟飞书消息。
- `testSetupEveryTwoDaysTrigger()`：创建每两日触发器。
- `testDailyPushDryRun()`：旧 Scholar Alert 补充流程 dry run。

本地验证命令：

```powershell
node tests/openalex_quality.test.js
Get-Content -Raw -Encoding UTF8 Code.gs | node --check -
node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8')); console.log('manifest ok')"
```

## 开源开发环境完整流程测试

以下入口仅用于当前隔离的开源开发项目验证，不是正式用户安装方式：

- `testEveryTwoDaysDryRun()`：预览双方向筛选结果，不发送消息、不写去重记录。
- `runOpenSourceDevFullFlowTest()`：发送一条包含两个方向各一篇文献的开发测试消息。
- `listOpenSourceDevTriggers()`：只读列出当前项目触发器并标记开发测试触发器。
- `setupOpenSourceDevTrigger()`：仅替换 `runOpenSourceDevScheduledTest` 对应的开发触发器，设置为每两日早上约 7:30 运行。
- `removeOpenSourceDevTrigger()`：仅删除开发测试触发器。
- `clearDevTestDedupRecords()`：仅清理开发测试去重记录。

开发完整流程会先校验当前 Apps Script 项目的 Script ID 指纹，并要求 `OPENALEX_API_KEY` 和 `FEISHU_WEBHOOK` 来自该开发项目的 Script Properties。测试消息固定带有 `Literature Radar Open Source Dev Test` 标识。开发记录保存在 `DEV_TEST_SENT_PAPER_KEYS_V1`，不会读取、写入或清理正式去重属性 `PUSHED_PAPER_KEYS_V1`。

创建触发器属于写操作，只能在完整流程消息人工确认通过后执行。Apps Script 的 `nearMinute(30)` 只能保证约 7:30；创建后的首次自动运行结果必须等待实际观察，不能预先视为通过。

## 如何设置两日触发器

运行：

```text
setupEveryTwoDaysTrigger()
```

该函数会先删除已有的 `runEveryTwoDaysOpenAlexPush` 触发器，再创建新的每两日触发器。

Apps Script 的 `nearMinute(30)` 不是秒级精确，实际运行时间可能在 7:30 前后约 15 分钟浮动。

## 如何停止旧每日触发器

如果之前已经创建了旧的 Gmail Scholar Alert 每日触发器，可以运行：

```text
deleteDailyScholarTrigger()
```

或者在 Apps Script 左侧“触发器”页面手动删除 handler 为 `runDailyScholarPush` 的触发器。

## 飞书 Webhook 设置

1. 打开飞书群聊。
2. 进入群设置或群机器人设置。
3. 添加“自定义机器人”。
4. 复制机器人 Webhook。
5. 在 Apps Script 脚本属性中填入 `FEISHU_WEBHOOK`。
6. 如启用签名校验，将签名密钥填入 `FEISHU_SIGN_SECRET`。
7. 如启用关键词安全策略，请确保关键词包含在推送文本中。

## 常见报错和解决

### 未配置 OpenAlex API Key

主动检索主流程需要 `OPENALEX_API_KEY`。请在 Apps Script 脚本属性中添加该属性。

### 飞书返回 HTTP 400

通常是 Webhook 错误、关键词安全策略不匹配，或签名密钥没有配置。检查 `FEISHU_WEBHOOK`、`FEISHU_SIGN_SECRET` 和群机器人安全设置。

### 主动检索没有候选

可能是 OpenAlex API Key 无效、网络请求失败、关键词过窄，或候选论文都已推送过。先运行 `testEveryTwoDaysDryRun()` 查看日志。

### Scholar Alert 搜索不到邮件

旧补充流程默认 Gmail 查询为：

```text
from:scholaralerts-noreply@google.com newer_than:7d
```

可以在 Gmail 中先手动搜索确认。如果邮件主题更稳定，也可以把 `CONFIG.GMAIL.SEARCH_QUERY` 改为 `subject:"Google Scholar Alert" newer_than:14d`。
