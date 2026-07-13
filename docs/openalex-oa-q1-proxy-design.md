# OpenAlex OA-Q1 Proxy 设计文档

更新日期：2026-07-13

## 背景

当前 Google Apps Script 项目已经实现：

- 每两日早上约 7:30 自动运行；
- 主动调用 OpenAlex Works API 检索近五年英文文献；
- 按生存分析领域和医学机器学习方向各筛选 1 篇；
- 通过飞书 Webhook 推送；
- 使用 `PropertiesService` 保存已推送论文指纹。

Google Scholar Alert 与 Gmail 解析模块仍保留为可选补充流程。OpenAlex-based venue quality proxy 的目标不是判断正式 JCR Q1，而是用 OpenAlex 的开放来源指标构造一个可解释的 OA-Q1 proxy，用于优先推荐更高质量来源的文章。

## 设计原则

- 主入口使用 `runEveryTwoDaysOpenAlexPush()`；`runDailyScholarPush()` 仅作为可选补充入口保留。
- 不爬取 Google Scholar 或 OpenAlex 网页，只调用 OpenAlex API。
- 不把 `OPENALEX_API_KEY`、`FEISHU_WEBHOOK` 或其他凭证写入代码。
- 主动检索缺少 API Key 时记录日志并停止；单个 Works 请求失败时该分块返回空结果，Source 请求失败时保留论文并使用降级评分。
- 所有新增代码保持 Apps Script JavaScript，可直接粘贴到 `Code.gs`。
- 推送文案明确说明 OA-Q1 proxy 不是官方 JCR quartile。

## 数据流

1. `runEveryTwoDaysOpenAlexPush()` 分别为两个方向查询近五年英文 Works；关键词通过 `title_and_abstract.search` 检索，并按最多 6 个一组拆分，合并后去重。
2. 过滤非英文、已撤稿、超出日期范围、已推送、标题为空和明显非论文的候选。
3. 只对方向关键词命中的候选补查完整 Source 指标。
4. 同一来源一次执行只请求一次，每个方向最多补查 20 个唯一来源。
5. 每个研究方向内部分别计算关键词相关度、来源指标百分位、引用百分位和新鲜度。
6. 计算 `venue_quality_score`、`citation_score`、`freshness_score`、`final_score` 和 `OA_Q1_PROXY`。
7. 每个方向选择 1 篇，构建飞书消息并推送。
8. 推送成功后保存 DOI、OpenAlex work ID 或标题哈希作为去重指纹。

## OpenAlex Enrichment

主动检索主要函数：

- `searchOpenAlexWorksByDirection_(directionConfig)`
- `buildOpenAlexWorksQueries_(directionConfig)`
- `fetchOpenAlexWorks_(queryParams)`
- `normalizeOpenAlexWorkToPaper_(work)`
- `enrichActiveSearchSourceMetrics_(papers, directionConfig)`

旧 Gmail 补充流程继续使用 `enrichPaperWithOpenAlex_()`、`searchOpenAlexWork_()` 和标题相似度匹配。DOI 优先、标题兜底、相似度不低于 `0.65` 的规则仍然保留。

匹配策略：

- DOI 优先：如果从链接、摘要或元数据中提取到 DOI，则使用 DOI 精确查询。
- 标题兜底：如果没有 DOI，则用标题调用 OpenAlex works search。
- 标题归一化：统一小写，去除标点和多余空格。
- 相似度阈值：低于 0.65 时标记为不可靠，不绑定 OpenAlex work。

输出字段会挂在 `paper.openalex` 上，包含：

- `work_id`
- `doi`
- `matched_title`
- `match_similarity`
- `source_id`
- `source_display_name`
- `m2yr`
- `h_index`
- `i10_index`
- `cited_by_count`
- `works_count`
- `source_type`
- `error_note`
- `fetched_at`

## 缓存设计

使用 `PropertiesService` 保存 30 天缓存，避免每次重复查询。

缓存分两类：

- work 缓存：title/doi 到 OpenAlex work 精简信息；
- source 缓存：source id 到 source metrics 精简信息。

缓存只保存必要字段，避免超过 Apps Script 属性大小限制。读取缓存时检查 `fetched_at`，超过 30 天则忽略并重新查询。

每次主动检索前会删除过期、损坏和超量缓存，work/source 缓存合计最多保留 300 条。

## 方向内来源质量评分

每个方向单独计算百分位，避免统计学期刊和医学 AI 期刊互相比较。

指标：

- `m2yr = summary_stats.2yr_mean_citedness`
- `h = summary_stats.h_index`
- `i10 = summary_stats.i10_index`

百分位规则：

- 指标越大，百分位越高；
- 缺失指标百分位为 0；
- 候选数量少于 5 时允许 fallback，但仍尽量使用当前候选相对分。

综合来源质量分：

```text
venue_quality_score = 0.60 * P_2yr + 0.30 * P_h + 0.10 * P_i10
```

## OA-Q1 Proxy 标记

每个方向内部标记：

- 候选数量不少于 5 时，按 `venue_quality_score` 排名前 25% 的来源标记为 `OA_Q1_PROXY = true`。
- 候选数量少于 5 时，`venue_quality_score >= 0.75` 或命中高质量来源白名单即可标记为 true。
- 白名单只作为 fallback 和加权项，不替代 OpenAlex 评分。

命名统一使用：

- `OA-Q1 proxy`
- `OpenAlex-based venue quality proxy`

不使用“JCR Q1”来描述该机制。

## 白名单

新增 `HIGH_QUALITY_SOURCE_WHITE_LIST`，按方向配置。

生存分析方向沿用统计学、生物统计、临床试验来源白名单，至少包含：

- Statistics in Medicine
- Biostatistics
- Biometrics
- Journal of the American Statistical Association
- The Annals of Statistics
- Biometrika
- Statistical Methods in Medical Research
- Clinical Trials
- Trials
- Controlled Clinical Trials
- Pharmaceutical Statistics
- Lifetime Data Analysis

医学机器学习、临床 AI 方向至少包含：

- Nature Medicine
- The Lancet Digital Health
- npj Digital Medicine
- JAMA
- JAMA Network Open
- BMJ
- BMJ Medicine
- NEJM AI
- Journal of Biomedical Informatics
- Artificial Intelligence in Medicine
- IEEE Journal of Biomedical and Health Informatics
- Patterns
- Nature Machine Intelligence
- Machine Learning
- IEEE Transactions on Pattern Analysis and Machine Intelligence

匹配规则忽略大小写、标点和多余空格，并支持常见别名，例如 `JASA`、`Annals of Statistics`、`Lancet Digital Health`。

## 最终筛选

保留原关键词相关度分，并新增最终综合分：

```text
final_score = 0.45 * relatedness_score_norm
            + 0.35 * venue_quality_score
            + 0.15 * citation_score
            + 0.05 * freshness_score
```

选择规则：

- 先排除已推送论文；
- 每个方向仍只选 1 篇；
- 优先选择 `OA_Q1_PROXY == true` 的候选；
- 如果没有 OA-Q1 proxy 候选，则选择 `final_score` 最高的候选；
- OpenAlex 未配置或失败时，回退到原来的关键词相关度排序。

## 飞书推送格式

每篇文献包含：

- Direction
- Title
- Authors
- Source / Venue
- Publication Date
- DOI
- Link
- Relatedness Score
- Venue Quality Score
- Citation Score
- Freshness Score
- Final Score
- OA-Q1 Proxy
- Why recommended
- OpenAlex Metrics
- Note

Note 固定包含：

```text
OA-Q1 proxy is based on OpenAlex metrics and is not official JCR quartile.
```

如果 OpenAlex enrichment 失败，Note 额外说明失败原因或回退状态。

## 错误处理

- `OPENALEX_API_KEY` 为空：记录日志并停止主动检索主流程，不发送空结果消息。
- OpenAlex Works 请求失败：记录日志，该方向返回空候选，不中断另一个方向和消息构建。
- OpenAlex Source 请求失败：保留论文，来源质量分使用降级逻辑，并在 Note 中说明。
- OpenAlex 返回 429：按 `retryAfter` 等待并重试一次，避免短时限流直接清空候选。
- JSON 解析失败：记录日志，跳过当前 enrichment。
- source 为空：设置 `source_display_name = UNKNOWN_SOURCE`。
- summary stats 缺失：指标记为 `null`，百分位按 0。
- 标题匹配相似度低：不绑定 OpenAlex work。
- 两个方向都找不到文献：仍推送“今日未检索到合适文献”。

## 验证范围

主要 Apps Script 测试函数：

- `testOpenAlexSearchByTitle()`
- `testOpenAlexSourceMetrics()`
- `testVenueQualityScoring()`
- `testDailyPushDryRun()`
- `testFeishuPushOnePaper()`
- `testOpenAlexActiveSearchStatistics()`
- `testOpenAlexActiveSearchMedicalML()`
- `testFiveYearDateRange()`
- `testEveryTwoDaysDryRun()`
- `testEveryTwoDaysFeishuPush()`
- `testSetupEveryTwoDaysTrigger()`

本地测试脚本覆盖：

- 验证标题归一化和相似度；
- 验证生存分析检索与筛选关键词；
- 验证来源指标补查、同来源去重请求和失败降级；
- 验证候选类型过滤和缓存清理；
- 验证百分位、白名单、OA-Q1 proxy 和 final score 排序；
- 验证去重 key、消息格式和近五年动态日期范围。

验证命令见项目 `README.md`；当前测试同时覆盖 Apps Script 纯函数逻辑、脚本语法和 manifest JSON。
