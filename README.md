# Literature Radar

Literature Radar 是一个运行在 Google Apps Script 上的轻量文献雷达：按用户配置的研究方向主动检索 OpenAlex，完成相关度与来源质量排序，并通过飞书自定义机器人定时推送。

项目不需要服务器或数据库。凭证、方向配置、去重记录和触发器都保存在使用者自己的 Apps Script 项目中。

> 当前版本为 beta。默认检索近五年英文文献；配置 v2 可调整语言、回溯年限、排除词和 OpenAlex Topic。每个方向选择 1 篇，每两天约 07:30（`Asia/Shanghai`）运行。

## 主要能力

- 通过 `LITERATURE_RADAR_CONFIG_JSON` 配置语言、回溯年限和 1–5 个研究方向，无需修改源码。
- 主动检索 OpenAlex Works，而不是依赖邮件是否到达。
- 过滤撤稿、非配置语言、超出时间范围、非论文类型及已推送候选。
- 综合 relatedness、venue quality、citation 和 freshness 进行排序。
- 标记 OpenAlex `OA-Q1 proxy`，并明确说明它不是正式 JCR 分区。
- 推送成功后记录 DOI、OpenAlex Work ID 或标题哈希，避免重复。
- 提供 dry run、配置检查、触发器创建与删除入口。

## 快速开始

### 1. 准备环境

需要：

- Google 账号与一个全新的 standalone Apps Script 项目；
- Node.js 20 或更高版本；
- OpenAlex API Key；
- 飞书群自定义机器人 Webhook。

启用 [Google Apps Script API](https://script.google.com/home/usersettings)，然后克隆仓库：

```powershell
git clone https://github.com/BRANGE-TT/literature-radar-open-source.git
cd literature-radar-open-source
npx @google/clasp login
```

### 2. 绑定自己的 Apps Script 项目

在 [Apps Script](https://script.google.com/home) 新建 standalone 项目，从“项目设置”复制 Script ID。不要使用其他项目的 ID。

```powershell
Copy-Item .clasp.json.example .clasp.json
```

macOS 或 Linux：

```sh
cp .clasp.json.example .clasp.json
```

将 `.clasp.json` 中的 `YOUR_NEW_APPS_SCRIPT_ID` 替换为自己的 Script ID，然后同步：

```powershell
npx @google/clasp push
```

`.claspignore` 只同步 `Code.gs` 和 `appsscript.json`。脚本属性和触发器不会从仓库复制。

### 3. 设置 Script Properties

先按[飞书自定义机器人指南](https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNxkjN)在目标群添加机器人并复制 Webhook。若启用“签名校验”，同时保存签名密钥；若启用“关键词”安全策略，关键词必须出现在推送文本中。

在 Apps Script 的“项目设置 → 脚本属性”中添加：

| 属性名 | 必填 | 用途 |
| --- | --- | --- |
| `OPENALEX_API_KEY` | 是 | OpenAlex API 认证 |
| `FEISHU_WEBHOOK` | 是 | 飞书自定义机器人 Webhook |
| `FEISHU_SIGN_SECRET` | 否 | 飞书机器人签名密钥 |
| `LITERATURE_RADAR_CONFIG_JSON` | 否 | 推荐的 v2 配置；支持语言、回溯年限、排除词和 OpenAlex Topic |
| `LITERATURE_DIRECTIONS_JSON` | 否 | 旧版方向数组；仅在未设置 v2 时读取 |

获取 API Key 请参考 [OpenAlex authentication](https://developers.openalex.org/guides/authentication)。OpenAlex 与飞书运行凭证只保存在自己的 Apps Script 项目中；`clasp login` 产生的本地 OAuth 凭证位于已忽略的 `.clasprc.json`，同样不得提交。

### 4. 选择想要的文献

推荐将版本化 JSON 对象保存为 `LITERATURE_RADAR_CONFIG_JSON`。例如：

```json
{
  "schemaVersion": 2,
  "language": "en",
  "yearsBack": 5,
  "directions": [
    {
      "id": "causal_inference",
      "label": "因果推断",
      "activeSearchKeywords": [
        "causal inference",
        "target trial emulation"
      ],
      "keywords": [
        "causal inference",
        "target trial",
        "inverse probability weighting"
      ],
      "excludeKeywords": ["animal model"],
      "openAlexTopicIds": []
    }
  ]
}
```

完整示例见 [`examples/config-v2.example.json`](examples/config-v2.example.json)。旧版 `LITERATURE_DIRECTIONS_JSON` 数组仍受支持，示例见 [`examples/directions.example.json`](examples/directions.example.json)；两个属性同时存在时 v2 优先。

顶层字段：

| 字段 | 规则 |
| --- | --- |
| `schemaVersion` | 必填，当前只能是 `2` |
| `language` | 可选，OpenAlex 使用的两位语言代码；默认 `en` |
| `yearsBack` | 可选，`1`–`20` 的整数；默认 `5` |
| `directions` | 必填，包含 1–5 个方向 |

方向字段：

| 字段 | 规则 |
| --- | --- |
| `id` | 必填、唯一；小写字母或数字开头，只允许小写字母、数字、`_`、`-`，最多 32 字符 |
| `label` | 必填；飞书消息中的方向名称，最多 60 字符 |
| `keywords` | 必填；用于相关度评分，1–50 项 |
| `activeSearchKeywords` | 可选；用于 OpenAlex 检索，1–12 项；省略时取 `keywords` 的前 12 项；不能包含逗号、换行或控制字符 |
| `excludeKeywords` | 可选，0–50 项；匹配标题、完整摘要或来源。英文/数字词按词或短语边界匹配，CJK 词按连续文本匹配 |
| `openAlexTopicIds` | 可选，0–20 项；接受 `T123` 或 `https://openalex.org/T123`，多个 ID 在同一方向内按 OR 过滤 |

单个关键词最多 100 字符。关键词会去除首尾空白并按大小写不敏感方式去重。v2 会拒绝未知字段和重复 Topic ID，避免拼写错误被静默忽略；显式 v2 无效时也不会回退到旧配置。Apps Script 对单个属性值另有 [9 KB 平台配额](https://developers.google.com/apps-script/guides/services/quotas)，配置应保持精简。

只有内置 `statistics` 和 `medical_ml` id 会使用对应的有限期刊白名单；其他 id 仍会根据同方向 OpenAlex 来源指标的百分位完成评分。

### 5. 验证并首次运行

在 Apps Script 编辑器中按顺序执行：

1. `validateLiteratureRadarConfig()`：只输出方向数量、关键词数量和凭证是否存在，不输出凭证值。
2. `testEveryTwoDaysDryRun()`：真实检索并预览推荐，不发送飞书、不写去重记录。
3. `runEveryTwoDaysOpenAlexPush()`：发送本次配置方向的推荐，并在成功后写入正式去重记录。

第 3 步会真实发送消息。请先检查 dry run，再手动执行一次确认飞书显示效果。

### 6. 创建定时触发器

确认首次推送正常后运行：

```text
setupEveryTwoDaysTrigger()
```

它只替换 handler 为 `runEveryTwoDaysOpenAlexPush` 的触发器，并创建每两天约 07:30 的新触发器。`nearMinute(30)` 可能前后浮动约 15 分钟。

停止自动推送时先运行 `listLiteratureRadarTriggers()` 核对，再运行 `removeEveryTwoDaysTrigger()`。删除函数只处理 `runEveryTwoDaysOpenAlexPush`，不会删除其他 handler。

## 用户入口

| 函数 | 是否发送 | 是否写去重 | 用途 |
| --- | --- | --- | --- |
| `validateLiteratureRadarConfig()` | 否 | 否 | 检查配置摘要 |
| `testEveryTwoDaysDryRun()` | 否 | 否 | 预览真实检索与筛选结果 |
| `runEveryTwoDaysOpenAlexPush()` | 是 | 是 | 正式执行一次推荐 |
| `setupEveryTwoDaysTrigger()` | 否 | 否 | 创建每两日触发器 |
| `listLiteratureRadarTriggers()` | 否 | 否 | 只读列出并标记本项目触发器 |
| `removeEveryTwoDaysTrigger()` | 否 | 否 | 只删除正式 Literature Radar 触发器 |
| `clearPushedHistory()` | 否 | 删除正式记录 | 清空正式去重；仅在明确需要重新推荐时使用 |

## 检索与评分

每个方向最多拉取 75 篇候选。检索词按最多 6 个一组拆分，语言和 Topic 过滤会应用到每个分块；结果优先按 OpenAlex `relevance_score`、再按引用量排序，合并后去重。排除词在本地标题、完整摘要和来源检查阶段生效；英文/数字词按词或短语边界匹配，CJK 词按连续文本匹配。每个方向最多补查 20 个唯一来源。

```text
venue_quality_score = 0.60 * P_2yr + 0.30 * P_h + 0.10 * P_i10

final_score = 0.45 * relatedness_score_norm
            + 0.35 * venue_quality_score
            + 0.15 * citation_score
            + 0.05 * freshness_score
```

`OA-Q1 proxy` 基于 OpenAlex 来源指标、方向内百分位和有限的内置来源白名单，仅用于排序辅助，不是正式 JCR Q1。

## 去重与缓存

- 正式去重属性：`PUSHED_PAPER_KEYS_V1`。
- 最多保留 500 个论文指纹。
- OpenAlex work/source 缓存保存 30 天，最多 300 条。
- 只有飞书返回成功后才写正式去重记录。
- 更换研究方向不会自动清除旧历史，因此同一论文仍可能被继续过滤。

## 可选 Gmail 补充流程

`runDailyScholarPush()` 可读取 Google Scholar Alert 邮件作为补充来源。默认 manifest 不包含 Gmail 权限；启用前需要把 `https://mail.google.com/` 加入 `appsscript.json` 的 `oauthScopes` 并重新授权。不需要 Gmail 时无需修改。

## 本地开发

以下命令适用于 macOS、Linux 和支持 shell 重定向的终端：

```sh
node tests/openalex_quality.test.js
node --check < Code.gs
node -e "const fs=require('fs'); ['appsscript.json','examples/directions.example.json','examples/config-v2.example.json'].forEach(f=>JSON.parse(fs.readFileSync(f,'utf8'))); console.log('json ok')"
```

PowerShell 的语法检查等价命令是：

```powershell
Get-Content -Raw -Encoding UTF8 Code.gs | node --check -
```

测试使用 mock Apps Script 环境，不访问 OpenAlex、Google 或飞书。GitHub Actions 会执行上述回归、语法和 JSON 检查。

贡献说明见 [`CONTRIBUTING.md`](CONTRIBUTING.md)，安全报告方式见 [`SECURITY.md`](SECURITY.md)。不要提交 `.clasp.json`、`.clasprc.json`、Webhook、API Key、OAuth Token、Script Properties 导出或未脱敏日志。

## 许可证

本项目采用 [MIT License](LICENSE)。

## 常见问题

### 配置后仍在使用默认方向

优先确认属性名完全等于 `LITERATURE_RADAR_CONFIG_JSON`，并检查 `schemaVersion` 是否为 `2`。若仍使用旧版数组，属性名应为 `LITERATURE_DIRECTIONS_JSON`。保存后运行 `validateLiteratureRadarConfig()`，根据 `configSource` 判断实际读取了 `v2`、`legacy` 还是 `default`。

### 主动检索没有候选

先运行 `testEveryTwoDaysDryRun()`。常见原因是 API Key 无效、关键词或 Topic 过滤过窄、排除词过宽、所有候选已推送，或文献不满足所选语言、回溯年限与非撤稿条件。

### 飞书返回 HTTP 400

检查 Webhook、签名密钥和机器人关键词安全策略。不要把完整 Webhook 或密钥粘贴到公开 Issue。
