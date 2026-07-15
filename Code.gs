/**
 * OpenAlex 主动检索 -> 飞书群机器人每两日文献推送
 *
 * 使用方式：
 * 1. 把本文件内容粘贴到 Google Apps Script 的 Code.gs。
 * 2. 在脚本属性中设置 FEISHU_WEBHOOK、OPENALEX_API_KEY 和可选的 LITERATURE_DIRECTIONS_JSON。
 * 3. 运行 validateLiteratureRadarConfig() 检查配置摘要。
 * 4. 运行 testEveryTwoDaysDryRun() 检查真实筛选结果。
 * 5. 确认后运行 runEveryTwoDaysOpenAlexPush() 完成首次推送。
 * 6. 最后运行 setupEveryTwoDaysTrigger() 创建每两日早上约 7:30 的触发器。
 * 7. Google Scholar Alert 与 Gmail 模块仍保留为可选补充流程。
 */

const CONFIG = {
  // 飞书自定义机器人 Webhook。也可以不写在这里，改用脚本属性 FEISHU_WEBHOOK。
  FEISHU_WEBHOOK: 'PASTE_YOUR_FEISHU_WEBHOOK_HERE',

  // 如果飞书机器人启用了“签名校验”，填写签名密钥；未启用则留空。
  // 也可以在脚本属性里设置 FEISHU_SIGN_SECRET。
  FEISHU_SIGN_SECRET: '',

  GMAIL: {
    // Gmail 搜索关键词。默认只读取最近 7 天的 Google Scholar Alert。
    SEARCH_QUERY: 'from:scholaralerts-noreply@google.com newer_than:7d',

    // Gmail 搜索返回的最大会话数。Google Scholar Alert 通常一个会话里有多封邮件。
    MAX_THREADS: 20,

    // 每天最多读取最近多少封邮件。
    MAX_EMAILS: 30
  },

  // 已推送论文指纹最多保留多少条，避免脚本属性过大。
  MAX_PUSHED_KEYS: 500,

  // 每篇摘要片段最多保留多少字符。
  MAX_SNIPPET_LENGTH: 360,

  OPENALEX: {
    // OpenAlex API 基础地址。只调用 API，不爬取网页。
    API_BASE_URL: 'https://api.openalex.org',

    // 标题匹配相似度低于该值时，不强行绑定 OpenAlex work。
    TITLE_SIMILARITY_THRESHOLD: 0.65,

    // 标题搜索最多取回多少条候选。
    MAX_SEARCH_RESULTS: 8,

    // OpenAlex 缓存有效期，单位：天。
    CACHE_DAYS: 30,

    // 最多保留多少条 OpenAlex work/source 缓存，避免脚本属性持续增长。
    MAX_CACHE_ENTRIES: 300,

    // 主动检索每个方向拉取的候选数量。
    ACTIVE_SEARCH_PER_PAGE: 75,

    // 主动检索时每个方向最多补查多少个唯一来源，避免执行时间过长。
    MAX_ACTIVE_SOURCE_LOOKUPS: 20,

    // 每个 Works 查询最多包含多少个检索词，避免触发宽布尔查询限流。
    MAX_SEARCH_TERMS_PER_QUERY: 6
  },

  TIMEZONE: 'Asia/Shanghai',

  DIRECTIONS: [
    {
      id: 'statistics',
      label: '生存分析领域',
      activeSearchLabel: 'Survival Analysis',
      activeSearchKeywords: [
        'survival analysis',
        'time-to-event',
        'Cox',
        'competing risks',
        'Kaplan-Meier',
        'restricted mean survival time',
        'multi-state model',
        'censored data',
        'RMTL'
      ],
      keywords: [
        'survival analysis',
        'survival',
        'survival model',
        'time-to-event',
        'time to event',
        'event time',
        'Cox',
        'cox model',
        'cox proportional hazards',
        'proportional hazards',
        'hazard',
        'hazard ratio',
        'competing risks',
        'competing risk',
        'Kaplan-Meier',
        'kaplan',
        'kaplan meier',
        'restricted mean survival time',
        'restricted mean time lost',
        'RMST',
        'RMTL',
        'multi-state model',
        'multi state model',
        'multistate model',
        'censored data',
        'censoring',
        'censored',
        'right-censored',
        'right censored',
        'failure time',
        'lifetime data',
        'frailty model'
      ]
    },
    {
      id: 'medical_ml',
      label: '医学与机器学习交叉方向',
      activeSearchLabel: 'Medical Machine Learning / Clinical AI',
      activeSearchKeywords: [
        'medical machine learning',
        'clinical machine learning',
        'artificial intelligence in medicine',
        'clinical prediction model',
        'electronic health records',
        'EHR',
        'deep learning medicine',
        'foundation model medicine',
        'healthcare AI',
        'medical imaging AI'
      ],
      keywords: [
        'medical machine learning',
        'clinical machine learning',
        'machine learning',
        'deep learning',
        'artificial intelligence',
        'ai in medicine',
        'clinical ai',
        'healthcare ai',
        'medical imaging',
        'electronic health records',
        'ehr',
        'clinical prediction model',
        'risk prediction',
        'diagnosis prediction',
        'prognosis prediction',
        'federated learning',
        'foundation model',
        'large language model',
        'radiology ai'
      ]
    }
  ]
};

const PROP_PUSHED_KEYS = 'PUSHED_PAPER_KEYS_V1';
const PROP_FEISHU_WEBHOOK = 'FEISHU_WEBHOOK';
const PROP_FEISHU_SIGN_SECRET = 'FEISHU_SIGN_SECRET';
const PROP_OPENALEX_API_KEY = 'OPENALEX_API_KEY';
const PROP_LITERATURE_DIRECTIONS_JSON = 'LITERATURE_DIRECTIONS_JSON';
const OPENALEX_WORK_CACHE_PREFIX = 'OPENALEX_WORK_CACHE_V1_';
const OPENALEX_SOURCE_CACHE_PREFIX = 'OPENALEX_SOURCE_CACHE_V1_';
const UNKNOWN_SOURCE = 'UNKNOWN_SOURCE';
const MAX_CUSTOM_DIRECTIONS = 5;
const MAX_DIRECTION_ID_LENGTH = 32;
const MAX_DIRECTION_LABEL_LENGTH = 60;
const MAX_ACTIVE_SEARCH_KEYWORDS = 12;
const MAX_SCORING_KEYWORDS = 50;
const MAX_KEYWORD_LENGTH = 100;

const HIGH_QUALITY_SOURCE_WHITE_LIST = {
  statistics: [
    'Statistics in Medicine',
    'Biostatistics',
    'Biometrics',
    'Journal of the American Statistical Association',
    'The Annals of Statistics',
    'Biometrika',
    'Statistical Methods in Medical Research',
    'Clinical Trials',
    'Trials',
    'Controlled Clinical Trials',
    'Pharmaceutical Statistics',
    'Lifetime Data Analysis'
  ],
  medical_ml: [
    'Nature Medicine',
    'The Lancet Digital Health',
    'npj Digital Medicine',
    'JAMA',
    'JAMA Network Open',
    'BMJ',
    'BMJ Medicine',
    'NEJM AI',
    'Journal of Biomedical Informatics',
    'Artificial Intelligence in Medicine',
    'IEEE Journal of Biomedical and Health Informatics',
    'Patterns',
    'Nature Machine Intelligence',
    'Machine Learning',
    'IEEE Transactions on Pattern Analysis and Machine Intelligence'
  ]
};

const HIGH_QUALITY_SOURCE_ALIASES = {
  jasa: 'Journal of the American Statistical Association',
  'annals of statistics': 'The Annals of Statistics',
  'lancet digital health': 'The Lancet Digital Health',
  'nejm ai': 'NEJM AI',
  jamia: 'Journal of the American Medical Informatics Association'
};

/**
 * 每日触发器入口函数。
 * 运行后会读取 Gmail、筛选两篇论文、推送到飞书，并在推送成功后记录去重指纹。
 */
function runDailyScholarPush() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('已有任务正在运行，本次跳过。');
    return;
  }

  try {
    const papers = enrichPapersWithOpenAlex_(fetchRecentScholarAlertPapers_());
    const directions = getConfiguredDirections_();
    const pushedKeys = getPushedKeys_();
    const reservedKeys = {};
    const selections = [];

    directions.forEach(function(direction) {
      const selected = selectBestPaperForDirection_(papers, direction, pushedKeys, reservedKeys);
      if (selected && selected.paperKey) {
        reservedKeys[selected.paperKey] = true;
      }
      selections.push({
        direction: direction,
        paper: selected
      });
    });

    const message = buildFeishuMessage_(selections, papers.length);
    postFeishuText_(message);
    savePushedSelectionsSafely_(pushedKeys, selections);
  } catch (err) {
    const safeMessage = sanitizeErrorForLog_(err);
    Logger.log(safeMessage);
    throw new Error(safeMessage);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 每两日 OpenAlex 主动检索入口函数。
 * 该函数是当前推荐主流程：主动检索近五年英文文献，而不是依赖 Gmail Scholar Alert。
 */
function runEveryTwoDaysOpenAlexPush() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('已有任务正在运行，本次跳过。');
    return;
  }

  try {
    const runtimeConfig = assertLiteratureRadarRuntimeConfig_();
    const apiKey = runtimeConfig.apiKey;

    pruneOpenAlexCaches_();
    const directions = runtimeConfig.directions;
    const pushedKeys = getPushedKeys_();
    const reservedKeys = {};
    const selections = [];
    let parsedCount = 0;

    directions.forEach(function(direction) {
      const candidates = searchOpenAlexWorksByDirection_(direction, apiKey, pushedKeys);
      parsedCount += candidates.length;
      const selected = selectBestPaperForDirection_(candidates, direction, pushedKeys, reservedKeys);
      if (selected && selected.paperKey) {
        reservedKeys[selected.paperKey] = true;
      }
      selections.push({
        direction: direction,
        paper: selected
      });
    });

    const message = buildFeishuMessage_(selections, parsedCount, {
      title: 'OpenAlex 近五年英文文献推荐',
      sourceDescription: 'OpenAlex active search over the last five years.',
      noResultReason: '可能原因：OpenAlex 近五年英文候选不足、关键词匹配不足，或候选论文已经推送过。'
    });
    postFeishuText_(message);
    savePushedSelectionsSafely_(pushedKeys, selections);
  } catch (err) {
    const safeMessage = sanitizeErrorForLog_(err);
    Logger.log(safeMessage);
    throw new Error(safeMessage);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 创建每天早上 7:30 自动运行的时间触发器。
 * Apps Script 的 nearMinute(30) 表示接近 30 分运行，平台可能有约 15 分钟浮动。
 */
function setupDailyTrigger() {
  deleteDailyTriggers_();

  ScriptApp.newTrigger('runDailyScholarPush')
    .timeBased()
    .inTimezone(CONFIG.TIMEZONE)
    .everyDays(1)
    .atHour(7)
    .nearMinute(30)
    .create();

  Logger.log('已创建每天早上约 7:30 运行的触发器。');
}

/**
 * 删除旧的 Gmail Scholar Alert 每日触发器。
 * 切换到 OpenAlex 每两日主动检索主流程后，可以手动运行本函数停用旧流程。
 */
function deleteDailyScholarTrigger() {
  deleteDailyTriggers_();
  Logger.log('已删除指向 runDailyScholarPush 的旧每日触发器。');
}

/**
 * 创建每两日早上 7:30 左右运行的 OpenAlex 主动检索触发器。
 */
function setupEveryTwoDaysTrigger() {
  assertLiteratureRadarRuntimeConfig_();
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'runEveryTwoDaysOpenAlexPush';
  });

  ScriptApp.newTrigger('runEveryTwoDaysOpenAlexPush')
    .timeBased()
    .inTimezone(CONFIG.TIMEZONE)
    .everyDays(2)
    .atHour(7)
    .nearMinute(30)
    .create();

  existing.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  Logger.log('已创建每两日早上约 7:30 运行的 OpenAlex 主动检索触发器；替换旧触发器数量：' + existing.length + '。');
}

/**
 * 只读列出当前项目触发器，并标明正式 Literature Radar 触发器。
 */
function listLiteratureRadarTriggers() {
  const descriptions = ScriptApp.getProjectTriggers().map(function(trigger) {
    const handlerFunction = trigger.getHandlerFunction();
    return {
      handlerFunction: handlerFunction,
      eventType: String(trigger.getEventType()),
      triggerSource: String(trigger.getTriggerSource()),
      isLiteratureRadar: handlerFunction === 'runEveryTwoDaysOpenAlexPush'
    };
  });
  Logger.log(JSON.stringify(descriptions));
  return descriptions;
}

/**
 * 只删除正式 Literature Radar handler 的触发器，不影响其他项目触发器。
 */
function removeEveryTwoDaysTrigger() {
  const deletedCount = deleteEveryTwoDaysTriggers_();
  Logger.log('已删除 Literature Radar 触发器数量：' + deletedCount);
  return deletedCount;
}

/**
 * 测试触发器创建：会删除旧的同名触发器并创建新的每两日触发器。
 */
function testSetupEveryTwoDaysTrigger() {
  setupEveryTwoDaysTrigger();
}

/**
 * 删除本脚本里指向 runDailyScholarPush 的旧触发器，避免重复推送。
 */
function deleteDailyTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runDailyScholarPush') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

/**
 * 删除本脚本里指向 runEveryTwoDaysOpenAlexPush 的旧触发器，避免重复推送。
 */
function deleteEveryTwoDaysTriggers_() {
  let deletedCount = 0;
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runEveryTwoDaysOpenAlexPush') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });
  return deletedCount;
}

/**
 * 测试飞书 Webhook 是否配置正确。
 */
function testFeishuPush() {
  const nowText = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  postFeishuText_('Google Scholar Alert 文献推送测试\n时间：' + nowText + '\n如果你能看到这条消息，说明 Webhook 可用。');
}

/**
 * 预览 Gmail 解析结果，不会推送飞书，也不会写入去重记录。
 */
function previewScholarPapers() {
  const papers = fetchRecentScholarAlertPapers_();
  Logger.log('共解析到 ' + papers.length + ' 篇候选论文。');
  papers.slice(0, 20).forEach(function(paper, index) {
    Logger.log(
      [
        '\n#' + (index + 1),
        'Title: ' + paper.title,
        'Authors: ' + paper.authors,
        'Source: ' + paper.source,
        'Link: ' + paper.link,
        'Snippet: ' + paper.snippet
      ].join('\n')
    );
  });
}

/**
 * 手动清空去重记录。只有在你确认想重新推送历史论文时再运行。
 */
function clearPushedHistory() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_PUSHED_KEYS);
  Logger.log('已清空历史推送记录。');
}

/**
 * 测试：按标题搜索 OpenAlex work。
 */
function testOpenAlexSearchByTitle() {
  const paper = {
    title: 'Deep learning for healthcare: review, opportunities and challenges',
    link: '',
    snippet: ''
  };
  const work = searchOpenAlexWork_(paper);
  Logger.log(JSON.stringify(work, null, 2));
}

/**
 * 测试：获取固定 source 的 OpenAlex 指标。
 */
function testOpenAlexSourceMetrics() {
  const source = fetchOpenAlexSourceById_('https://openalex.org/S4210207862');
  Logger.log(JSON.stringify(source, null, 2));
}

/**
 * 测试：构造 mock 文献，验证来源质量评分。
 */
function testVenueQualityScoring() {
  const direction = CONFIG.DIRECTIONS[0];
  const papers = [
    { title: 'A', source: 'Statistics in Medicine', openalex: { source_display_name: 'Statistics in Medicine', m2yr: 10, h_index: 200, i10_index: 400 } },
    { title: 'B', source: 'Clinical Trials', openalex: { source_display_name: 'Clinical Trials', m2yr: 5, h_index: 80, i10_index: 100 } },
    { title: 'C', source: 'Unknown', openalex: { source_display_name: 'Unknown', m2yr: 1, h_index: 5, i10_index: 10 } }
  ];
  Logger.log(JSON.stringify(applyVenueQualityScores_(papers, direction), null, 2));
}

/**
 * 测试：完整筛选 dry run，不推送飞书、不写入去重记录。
 */
function testDailyPushDryRun() {
  const papers = enrichPapersWithOpenAlex_(fetchRecentScholarAlertPapers_());
  const directions = getConfiguredDirections_();
  const pushedKeys = getPushedKeys_();
  const reservedKeys = {};
  const selections = directions.map(function(direction) {
    const paper = selectBestPaperForDirection_(papers, direction, pushedKeys, reservedKeys);
    if (paper && paper.paperKey) {
      reservedKeys[paper.paperKey] = true;
    }
    return { direction: direction, paper: paper };
  });
  Logger.log(buildFeishuMessage_(selections, papers.length));
}

/**
 * 测试：只推送一条带 OpenAlex 字段的模拟文献消息。
 */
function testFeishuPushOnePaper() {
  const message = buildFeishuMessage_([
    {
      direction: CONFIG.DIRECTIONS[0],
      paper: {
        title: 'Mock survival analysis paper',
        authors: 'A Author',
        source: 'Statistics in Medicine',
        publicationDate: '2026-07-04',
        link: 'https://example.org/mock',
        relatedness_score_norm: 0.82,
        venue_quality_score: 0.91,
        OA_Q1_PROXY: true,
        whyRecommended: 'This paper matches survival analysis and comes from a high-quality venue.',
        openalex: {
          source_display_name: 'Statistics in Medicine',
          m2yr: 8.5,
          h_index: 180,
          i10_index: 450
        }
      }
    }
  ], 1);
  postFeishuText_(message);
}

/**
 * 测试：生存分析领域 OpenAlex 主动检索。
 */
function testOpenAlexActiveSearchStatistics() {
  const papers = searchOpenAlexWorksByDirection_(CONFIG.DIRECTIONS[0]);
  Logger.log(JSON.stringify(papers.slice(0, 5), null, 2));
}

/**
 * 测试：医学机器学习方向 OpenAlex 主动检索。
 */
function testOpenAlexActiveSearchMedicalML() {
  const papers = searchOpenAlexWorksByDirection_(CONFIG.DIRECTIONS[1]);
  Logger.log(JSON.stringify(papers.slice(0, 5), null, 2));
}

/**
 * 测试：近五年日期范围。
 */
function testFiveYearDateRange() {
  Logger.log(JSON.stringify(getFiveYearDateRange_(), null, 2));
}

/**
 * 测试：每两日主动检索 dry run，不推送飞书、不写入去重记录。
 */
function testEveryTwoDaysDryRun() {
  const directions = getConfiguredDirections_();
  const pushedKeys = getPushedKeys_();
  const reservedKeys = {};
  const selections = [];
  let parsedCount = 0;

  directions.forEach(function(direction) {
    const candidates = searchOpenAlexWorksByDirection_(direction, null, pushedKeys);
    Logger.log(direction.label + '候选数：' + candidates.length);
    parsedCount += candidates.length;
    const selected = selectBestPaperForDirection_(candidates, direction, pushedKeys, reservedKeys);
    if (selected && selected.paperKey) {
      reservedKeys[selected.paperKey] = true;
    }
    selections.push({
      direction: direction,
      paper: selected
    });
  });

  Logger.log(buildFeishuMessage_(selections, parsedCount, {
    title: 'OpenAlex 近五年英文文献推荐',
    sourceDescription: 'OpenAlex active search over the last five years.',
    noResultReason: '可能原因：OpenAlex 近五年英文候选不足、关键词匹配不足，或候选论文已经推送过。'
  }));
}

/**
 * 测试：只推送一条每两日主动检索格式的模拟消息。
 */
function testEveryTwoDaysFeishuPush() {
  const message = buildFeishuMessage_([
    {
      direction: CONFIG.DIRECTIONS[1],
      paper: {
        title: 'Mock clinical AI paper',
        authors: 'A Author',
        source: 'npj Digital Medicine',
        publicationDate: '2026-07-04',
        publicationYear: 2026,
        doi: '10.1000/mock-ai',
        link: 'https://example.org/mock-ai',
        relatedness_score_norm: 0.86,
        venue_quality_score: 0.9,
        citation_score: 0.7,
        freshness_score: 1,
        final_score: 0.86,
        OA_Q1_PROXY: true,
        whyRecommended: 'This paper is related to clinical AI and comes from a strong medical AI venue.',
        dataSource: 'openalex_active_search',
        openalex: {
          openalex_work_id: 'https://openalex.org/WMOCK',
          source_display_name: 'npj Digital Medicine',
          m2yr: 9,
          h_index: 120,
          i10_index: 300,
          cited_by_count: 25,
          works_count: 1000,
          source_type: 'journal'
        }
      }
    }
  ], 1, {
    title: 'OpenAlex 近五年英文文献推荐',
    sourceDescription: 'OpenAlex active search over the last five years.'
  });
  postFeishuText_(message);
}

/**
 * 按方向主动检索 OpenAlex works。
 */
function searchOpenAlexWorksByDirection(directionConfig, apiKey, pushedKeys) {
  return searchOpenAlexWorksByDirection_(directionConfig, apiKey, pushedKeys);
}

/**
 * 按方向主动检索 OpenAlex works。
 */
function searchOpenAlexWorksByDirection_(directionConfig, apiKey, pushedKeys) {
  const resolvedApiKey = apiKey || getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  if (!resolvedApiKey) {
    Logger.log('未配置 OpenAlex API Key，停止 OpenAlex 主动检索流程。');
    return [];
  }

  const range = getFiveYearDateRange_();
  const queryParamsList = buildOpenAlexWorksQueries_(directionConfig, range);
  let works = [];
  queryParamsList.forEach(function(queryParams) {
    queryParams.api_key = resolvedApiKey;
    works = works.concat(fetchOpenAlexWorks_(queryParams));
  });
  works = dedupeOpenAlexWorks_(works, CONFIG.OPENALEX.ACTIVE_SEARCH_PER_PAGE);
  const pushed = pushedKeys || [];
  const papers = works
    .map(function(work) {
      return normalizeOpenAlexWorkToPaper_(work);
    })
    .filter(function(paper) {
      return isValidActiveSearchPaper_(paper, range, pushed);
    });

  enrichActiveSearchSourceMetrics_(papers, directionConfig, resolvedApiKey);
  computeCitationScores_(papers);
  return papers;
}

/**
 * 为主动检索中真正命中方向关键词的候选补全来源指标。
 * 同一来源只查询一次，并限制单方向查询数量，避免 Apps Script 执行超时。
 */
function enrichActiveSearchSourceMetrics_(papers, directionConfig, apiKey, fetchSourceFn) {
  const ranked = papers.map(function(paper) {
    return {
      paper: paper,
      relatedness: scorePaperForDirection_(paper, directionConfig).total
    };
  }).filter(function(item) {
    return item.relatedness > 0;
  }).sort(function(a, b) {
    if (b.relatedness !== a.relatedness) {
      return b.relatedness - a.relatedness;
    }
    return (b.paper.cited_by_count || 0) - (a.paper.cited_by_count || 0);
  });

  const sourceMetricsById = {};
  const maxLookups = CONFIG.OPENALEX.MAX_ACTIVE_SOURCE_LOOKUPS;
  let lookupCount = 0;

  ranked.forEach(function(item) {
    const paper = item.paper;
    const source = paper.openalex || {};
    const sourceId = normalizeOpenAlexId_(source.source_id);
    if (!sourceId || !isIncompleteSourceMetrics_(source)) {
      return;
    }

    let fetchedSource;
    if (Object.prototype.hasOwnProperty.call(sourceMetricsById, sourceId)) {
      fetchedSource = sourceMetricsById[sourceId];
    } else {
      if (lookupCount >= maxLookups) {
        return;
      }
      lookupCount++;
      try {
        fetchedSource = fetchSourceFn
          ? fetchSourceFn(sourceId, apiKey)
          : fetchOpenAlexSourceById_(sourceId, apiKey);
      } catch (err) {
        logSafeError_('OpenAlex source 指标补全失败：', err);
        fetchedSource = null;
      }
      sourceMetricsById[sourceId] = fetchedSource;
    }

    if (!fetchedSource) {
      paper.openalex.error_note = 'OpenAlex source metrics request failed; venue quality fallback used.';
      return;
    }

    paper.openalex = mergeSourceMetrics_(source, fetchedSource);
    if (paper.openalex.source_display_name && paper.openalex.source_display_name !== UNKNOWN_SOURCE) {
      paper.source = paper.openalex.source_display_name;
    }
  });

  return papers;
}

/**
 * 公开测试入口：构造 OpenAlex Works 查询参数。
 */
function buildOpenAlexWorksQuery(directionConfig, dateRange) {
  return buildOpenAlexWorksQuery_(directionConfig, dateRange);
}

/**
 * 公开测试入口：按布尔操作符限制构造多个 OpenAlex Works 查询。
 */
function buildOpenAlexWorksQueries(directionConfig, dateRange) {
  return buildOpenAlexWorksQueries_(directionConfig, dateRange);
}

/**
 * 将方向关键词拆成多个查询，并在分块之间平均分配候选配额。
 */
function buildOpenAlexWorksQueries_(directionConfig, dateRange) {
  const keywords = directionConfig.activeSearchKeywords || directionConfig.keywords || [];
  if (!keywords.length) {
    return [];
  }

  const chunkSize = CONFIG.OPENALEX.MAX_SEARCH_TERMS_PER_QUERY;
  const chunks = [];
  for (let index = 0; index < keywords.length; index += chunkSize) {
    chunks.push(keywords.slice(index, index + chunkSize));
  }

  const baseSize = Math.floor(CONFIG.OPENALEX.ACTIVE_SEARCH_PER_PAGE / chunks.length);
  const remainder = CONFIG.OPENALEX.ACTIVE_SEARCH_PER_PAGE % chunks.length;
  return chunks.map(function(chunk, index) {
    const query = buildOpenAlexWorksQuery_({
      activeSearchKeywords: chunk
    }, dateRange);
    query.per_page = baseSize + (index < remainder ? 1 : 0);
    return query;
  });
}

/**
 * 构造 OpenAlex Works 查询参数。
 */
function buildOpenAlexWorksQuery_(directionConfig, dateRange) {
  const keywords = directionConfig.activeSearchKeywords || directionConfig.keywords || [];
  const range = dateRange || getFiveYearDateRange_();
  return {
    filter: [
      'from_publication_date:' + range.fromDate,
      'to_publication_date:' + range.toDate,
      'language:en',
      'is_retracted:false'
    ].join(','),
    search: keywords.join(' OR '),
    sort: 'relevance_score:desc,cited_by_count:desc',
    select: [
      'id',
      'doi',
      'title',
      'display_name',
      'publication_date',
      'publication_year',
      'type',
      'language',
      'cited_by_count',
      'relevance_score',
      'authorships',
      'primary_location',
      'locations',
      'abstract_inverted_index'
    ].join(','),
    per_page: CONFIG.OPENALEX.ACTIVE_SEARCH_PER_PAGE
  };
}

/**
 * 公开测试入口：调用 OpenAlex Works API。
 */
function fetchOpenAlexWorks(queryParams) {
  return fetchOpenAlexWorks_(queryParams);
}

/**
 * 调用 OpenAlex Works API。
 */
function fetchOpenAlexWorks_(queryParams) {
  try {
    const json = fetchOpenAlexJson_(buildOpenAlexUrl_('/works', queryParams || {}));
    return json && Array.isArray(json.results) ? json.results : [];
  } catch (err) {
    logSafeError_('OpenAlex Works 主动检索失败：', err);
    return [];
  }
}

/**
 * 合并多个关键词分块返回的 works，按 OpenAlex ID、DOI 或标题去重。
 */
function dedupeOpenAlexWorks_(works, limit) {
  const seen = {};
  const unique = [];
  (works || []).forEach(function(work) {
    const key = work && work.id ||
      work && work.doi ||
      normalizeOpenAlexTitle_(work && (work.title || work.display_name));
    if (!key) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(seen, key)) {
      const existingIndex = seen[key];
      if (compareOpenAlexWorksBySearchRank_(work, unique[existingIndex]) < 0) {
        unique[existingIndex] = work;
      }
      return;
    }
    seen[key] = unique.length;
    unique.push(work);
  });
  unique.sort(compareOpenAlexWorksBySearchRank_);
  return unique.slice(0, typeof limit === 'number' ? limit : unique.length);
}

function compareOpenAlexWorksBySearchRank_(a, b) {
  const relevanceDiff = (b && b.relevance_score || 0) - (a && a.relevance_score || 0);
  if (relevanceDiff !== 0) {
    return relevanceDiff;
  }
  return (b && b.cited_by_count || 0) - (a && a.cited_by_count || 0);
}

/**
 * 公开测试入口：标准化 OpenAlex work。
 */
function normalizeOpenAlexWorkToPaper(work) {
  return normalizeOpenAlexWorkToPaper_(work);
}

/**
 * 将 OpenAlex work 标准化为现有 paper 结构。
 */
function normalizeOpenAlexWorkToPaper_(work) {
  const source = extractSourceFromOpenAlexWork_(work);
  const title = work && (work.title || work.display_name) ? (work.title || work.display_name) : '';
  const abstractText = reconstructAbstract_(work && work.abstract_inverted_index);
  const authors = extractOpenAlexAuthors_(work);
  const doi = normalizeDoi_(work && work.doi);
  const link = getOpenAlexLandingPageUrl_(work, doi);

  return {
    title: title,
    authors: authors,
    source: source.source_display_name || UNKNOWN_SOURCE,
    link: link,
    doi: doi,
    snippet: limitText_(abstractText, CONFIG.MAX_SNIPPET_LENGTH),
    publicationDate: work && work.publication_date ? work.publication_date : '',
    publicationYear: work && work.publication_year ? work.publication_year : null,
    emailDate: parseDateForScoring_(work && work.publication_date, work && work.publication_year),
    cited_by_count: toNullableNumber_(work && work.cited_by_count),
    workType: work && work.type ? work.type : '',
    language: work && work.language ? work.language : '',
    dataSource: 'openalex_active_search',
    openalex: {
      openalex_work_id: work && work.id ? work.id : '',
      doi: doi,
      title: title,
      publication_date: work && work.publication_date ? work.publication_date : '',
      publication_year: work && work.publication_year ? work.publication_year : null,
      source_id: source.source_id || '',
      source_display_name: source.source_display_name || UNKNOWN_SOURCE,
      m2yr: source.m2yr,
      h_index: source.h_index,
      i10_index: source.i10_index,
      cited_by_count: toNullableNumber_(work && work.cited_by_count),
      works_count: source.works_count,
      source_type: source.source_type || '',
      issn_l: source.issn_l || '',
      work_type: work && work.type ? work.type : '',
      language: work && work.language ? work.language : '',
      fetched_at: new Date().toISOString()
    }
  };
}

/**
 * 将 OpenAlex abstract_inverted_index 还原为摘要文本。
 */
function reconstructAbstract_(abstractInvertedIndex) {
  if (!abstractInvertedIndex) {
    return '';
  }
  const positions = [];
  Object.keys(abstractInvertedIndex).forEach(function(word) {
    const indexes = abstractInvertedIndex[word] || [];
    indexes.forEach(function(index) {
      positions[index] = word;
    });
  });
  return positions.filter(function(word) {
    return !!word;
  }).join(' ');
}

/**
 * 计算近五年日期范围。
 */
function getFiveYearDateRange_(now) {
  const to = now ? new Date(now.getTime()) : new Date();
  const from = new Date(to.getTime());
  from.setFullYear(from.getFullYear() - 5);
  return {
    fromDate: formatIsoDate_(from),
    toDate: formatIsoDate_(to)
  };
}

/**
 * ISO 日期格式化。
 */
function formatIsoDate_(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * 提取 OpenAlex 作者列表。
 */
function extractOpenAlexAuthors_(work) {
  const authorships = work && Array.isArray(work.authorships) ? work.authorships : [];
  const names = authorships.map(function(authorship) {
    return authorship && authorship.author ? authorship.author.display_name : '';
  }).filter(function(name) {
    return !!name;
  });
  return names.length ? names.slice(0, 8).join('; ') : 'Unknown';
}

/**
 * 获取 OpenAlex work 落地页链接。
 */
function getOpenAlexLandingPageUrl_(work, doi) {
  const locationUrl = work &&
    work.primary_location &&
    work.primary_location.landing_page_url
    ? work.primary_location.landing_page_url
    : '';
  if (locationUrl) {
    return locationUrl;
  }
  if (doi) {
    return 'https://doi.org/' + doi;
  }
  return work && work.id ? work.id : '';
}

/**
 * 判断 OpenAlex 主动检索候选是否可进入评分。
 */
function isValidActiveSearchPaper_(paper, dateRange, pushedKeys) {
  if (!paper || !paper.title) {
    return false;
  }
  if (pushedKeys && pushedKeys.indexOf(makePaperKey_(paper)) !== -1) {
    return false;
  }
  if (paper.language && paper.language !== 'en') {
    return false;
  }
  if (paper.workType && !isAcademicWorkType_(paper.workType)) {
    return false;
  }
  if (!isWithinDateRange_(paper.publicationDate, paper.publicationYear, dateRange)) {
    return false;
  }
  return true;
}

/**
 * 判断 work 类型是否接近学术论文。
 */
function isAcademicWorkType_(type) {
  const normalized = normalizeOpenAlexTitle_(type);
  return [
    'article',
    'preprint',
    'book chapter',
    'review'
  ].indexOf(normalized) !== -1;
}

/**
 * 判断发布日期是否在目标范围。
 */
function isWithinDateRange_(publicationDate, publicationYear, dateRange) {
  const date = parseDateForScoring_(publicationDate, publicationYear);
  if (!date) {
    return false;
  }
  const value = safeDateValue_(date);
  const from = safeDateValue_(new Date(dateRange.fromDate + 'T00:00:00Z'));
  const to = safeDateValue_(new Date(dateRange.toDate + 'T23:59:59Z'));
  return value >= from && value <= to;
}

/**
 * 解析用于评分的日期。
 */
function parseDateForScoring_(publicationDate, publicationYear) {
  if (publicationDate) {
    const parsed = new Date(publicationDate + 'T00:00:00Z');
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  if (publicationYear) {
    const yearDate = new Date(String(publicationYear) + '-07-01T00:00:00Z');
    if (!isNaN(yearDate.getTime())) {
      return yearDate;
    }
  }
  return null;
}

/**
 * 计算同方向候选文献内部的引用百分位分。
 */
function computeCitationScores(papers) {
  return computeCitationScores_(papers);
}

/**
 * 计算同方向候选文献内部的引用百分位分。
 */
function computeCitationScores_(papers) {
  const values = papers.map(function(paper) {
    const value = typeof paper.cited_by_count === 'number'
      ? paper.cited_by_count
      : paper.openalex && typeof paper.openalex.cited_by_count === 'number'
        ? paper.openalex.cited_by_count
        : null;
    return typeof value === 'number' && !isNaN(value) ? value : null;
  });
  const validValues = values.filter(function(value) {
    return typeof value === 'number' && !isNaN(value);
  }).sort(function(a, b) {
    return a - b;
  });

  papers.forEach(function(paper, index) {
    const value = values[index];
    if (typeof value !== 'number' || isNaN(value) || !validValues.length) {
      paper.citation_score = 0;
      return;
    }

    let lowerCount = 0;
    validValues.forEach(function(candidate) {
      if (candidate < value) {
        lowerCount++;
      }
    });
    paper.citation_score = clampScore_((lowerCount + 1) / validValues.length);
  });
  return papers;
}

/**
 * 对候选论文批量补充 OpenAlex 信息。
 */
function enrichPapersWithOpenAlex_(papers) {
  const apiKey = getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  if (!apiKey) {
    Logger.log('未配置 OpenAlex API Key，跳过 OpenAlex 质量评分。');
    return papers;
  }

  pruneOpenAlexCaches_();
  return papers.map(function(paper) {
    try {
      return enrichPaperWithOpenAlex_(paper, apiKey);
    } catch (err) {
      logSafeError_('OpenAlex enrichment 失败：', err);
      paper.openalex = paper.openalex || {};
      paper.openalex.error_note = 'OpenAlex API request failed; fallback to keyword relatedness.';
      return paper;
    }
  });
}

/**
 * 公开测试入口：补充单篇论文 OpenAlex 信息。
 */
function enrichPaperWithOpenAlex(paper) {
  return enrichPaperWithOpenAlex_(paper);
}

/**
 * 补充单篇论文 OpenAlex 信息。
 */
function enrichPaperWithOpenAlex_(paper, apiKey) {
  const resolvedApiKey = apiKey || getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  if (!resolvedApiKey) {
    paper.openalex = {
      source_display_name: UNKNOWN_SOURCE,
      error_note: '未配置 OpenAlex API Key，跳过 OpenAlex 质量评分。'
    };
    return paper;
  }

  const cacheLookupKey = getOpenAlexWorkCacheLookupKey_(paper);
  const cached = readOpenAlexCache_(OPENALEX_WORK_CACHE_PREFIX, cacheLookupKey);
  if (cached) {
    paper.openalex = cached;
    return paper;
  }

  const work = searchOpenAlexWork_(paper, resolvedApiKey);
  if (!work) {
    paper.openalex = {
      source_display_name: UNKNOWN_SOURCE,
      error_note: 'No reliable OpenAlex work match.'
    };
    writeOpenAlexCache_(OPENALEX_WORK_CACHE_PREFIX, cacheLookupKey, paper.openalex);
    return paper;
  }

  let source = extractSourceFromOpenAlexWork_(work);
  if (source.source_id && isIncompleteSourceMetrics_(source)) {
    const fetchedSource = fetchOpenAlexSourceById_(source.source_id, resolvedApiKey);
    source = mergeSourceMetrics_(source, fetchedSource);
  }

  const openalex = {
    openalex_work_id: work.id || '',
    doi: normalizeDoi_(work.doi || extractDoi_(paper)),
    title: work.title || work.display_name || '',
    publication_date: work.publication_date || '',
    match_similarity: typeof work.__match_similarity === 'number' ? work.__match_similarity : null,
    source_id: source.source_id || '',
    source_display_name: source.source_display_name || UNKNOWN_SOURCE,
    m2yr: source.m2yr,
    h_index: source.h_index,
    i10_index: source.i10_index,
    cited_by_count: source.cited_by_count,
    works_count: source.works_count,
    source_type: source.source_type || '',
    issn_l: source.issn_l || '',
    fetched_at: new Date().toISOString()
  };

  paper.openalex = openalex;
  writeOpenAlexCache_(OPENALEX_WORK_CACHE_PREFIX, cacheLookupKey, openalex);
  return paper;
}

/**
 * 公开测试入口：搜索 OpenAlex work。
 */
function searchOpenAlexWork(paper) {
  return searchOpenAlexWork_(paper);
}

/**
 * 查询 OpenAlex work，优先 DOI，兜底标题搜索。
 */
function searchOpenAlexWork_(paper, apiKey) {
  const resolvedApiKey = apiKey || getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  if (!resolvedApiKey) {
    Logger.log('未配置 OpenAlex API Key，跳过 OpenAlex work 查询。');
    return null;
  }
  const doi = extractDoi_(paper);
  let url;

  if (doi) {
    url = buildOpenAlexUrl_('/works', {
      filter: 'doi:https://doi.org/' + doi,
      per_page: 1,
      api_key: resolvedApiKey
    });
  } else {
    url = buildOpenAlexUrl_('/works', {
      search: paper.title || '',
      per_page: CONFIG.OPENALEX.MAX_SEARCH_RESULTS,
      api_key: resolvedApiKey
    });
  }

  const json = fetchOpenAlexJson_(url);
  const results = json && Array.isArray(json.results) ? json.results : [];
  return selectBestOpenAlexWorkMatch_(paper, results);
}

/**
 * 公开测试入口：选择最佳 OpenAlex work 匹配。
 */
function selectBestOpenAlexWorkMatch(paper, results) {
  return selectBestOpenAlexWorkMatch_(paper, results);
}

/**
 * 从 OpenAlex 搜索结果中选择标题最接近的一条。
 */
function selectBestOpenAlexWorkMatch_(paper, results) {
  if (!Array.isArray(results) || !results.length) {
    return null;
  }

  const paperDoi = extractDoi_(paper);
  let best = null;
  let bestScore = 0;

  results.forEach(function(work) {
    const workDoi = normalizeDoi_(work && work.doi);
    const title = work && (work.title || work.display_name);
    let score = computeTitleSimilarity_(paper.title, title);

    if (paperDoi && workDoi && paperDoi === workDoi) {
      score = 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = work;
    }
  });

  if (!best || bestScore < CONFIG.OPENALEX.TITLE_SIMILARITY_THRESHOLD) {
    return null;
  }

  best.__match_similarity = bestScore;
  return best;
}

/**
 * 公开测试入口：从 OpenAlex work 提取 source。
 */
function extractSourceFromOpenAlexWork(work) {
  return extractSourceFromOpenAlexWork_(work);
}

/**
 * 从 OpenAlex work 提取来源指标。
 */
function extractSourceFromOpenAlexWork_(work) {
  const source = work &&
    work.primary_location &&
    work.primary_location.source
    ? work.primary_location.source
    : findFirstOpenAlexSource_(work);
  return extractSourceMetrics_(source);
}

/**
 * 公开测试入口：查询 OpenAlex source。
 */
function fetchOpenAlexSourceById(sourceId) {
  return fetchOpenAlexSourceById_(sourceId);
}

/**
 * 查询完整 OpenAlex source 对象。
 */
function fetchOpenAlexSourceById_(sourceId, apiKey) {
  const normalizedSourceId = normalizeOpenAlexId_(sourceId);
  if (!normalizedSourceId) {
    return extractSourceMetrics_(null);
  }

  const cached = readOpenAlexCache_(OPENALEX_SOURCE_CACHE_PREFIX, normalizedSourceId);
  if (cached) {
    return cached;
  }

  const resolvedApiKey = apiKey || getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  if (!resolvedApiKey) {
    Logger.log('未配置 OpenAlex API Key，跳过 OpenAlex source 查询。');
    return extractSourceMetrics_(null);
  }
  const json = fetchOpenAlexJson_(buildOpenAlexUrl_('/sources/' + encodeURIComponent(normalizedSourceId), {
    api_key: resolvedApiKey
  }));
  const source = extractSourceMetrics_(json);
  writeOpenAlexCache_(OPENALEX_SOURCE_CACHE_PREFIX, normalizedSourceId, source);
  return source;
}

/**
 * 发送 OpenAlex API 请求。
 */
function fetchOpenAlexJson_(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = UrlFetchApp.fetch(url, {
        method: 'get',
        muteHttpExceptions: true
      });
    } catch (err) {
      throw new Error(sanitizeErrorForLog_(err));
    }
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 429 && attempt === 0) {
      Utilities.sleep(getOpenAlexRetryAfterMs_(body));
      continue;
    }
    if (status < 200 || status >= 300) {
      throw new Error(sanitizeErrorForLog_('OpenAlex API 请求失败，HTTP 状态码：' + status + '，响应：' + body));
    }

    try {
      return JSON.parse(body);
    } catch (err) {
      logSafeError_('OpenAlex JSON 解析失败：', err);
      throw err;
    }
  }
  throw new Error('OpenAlex API 请求失败：重试后仍未返回有效响应。');
}

/**
 * 从 OpenAlex 429 响应中读取等待秒数，并限制在合理范围内。
 */
function getOpenAlexRetryAfterMs_(body) {
  let retryAfterSeconds = 1;
  try {
    const parsed = JSON.parse(body);
    const value = Number(parsed && parsed.retryAfter);
    if (!isNaN(value) && value > 0) {
      retryAfterSeconds = value;
    }
  } catch (err) {
    retryAfterSeconds = 1;
  }
  return Math.max(1000, Math.min(5000, retryAfterSeconds * 1000 + 200));
}

/**
 * 构建 OpenAlex API URL。
 */
function buildOpenAlexUrl_(path, params) {
  const query = [];
  Object.keys(params || {}).forEach(function(key) {
    const value = params[key];
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      query.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    }
  });
  return CONFIG.OPENALEX.API_BASE_URL + path + (query.length ? '?' + query.join('&') : '');
}

/**
 * 从 paper 中提取 DOI。
 */
function extractDoi_(paper) {
  const text = [
    paper && paper.doi,
    paper && paper.link,
    paper && paper.snippet,
    paper && paper.source
  ].join(' ');
  const match = String(text || '').match(/10\.\d{4,9}\/[^\s"'<>]+/i);
  return match ? normalizeDoi_(match[0]) : '';
}

/**
 * DOI 归一化。
 */
function normalizeDoi_(doi) {
  return String(doi || '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:/i, '')
    .replace(/[).,;]+$/g, '')
    .toLowerCase()
    .trim();
}

/**
 * 从 locations 中兜底查找 source。
 */
function findFirstOpenAlexSource_(work) {
  const locations = work && Array.isArray(work.locations) ? work.locations : [];
  for (let i = 0; i < locations.length; i++) {
    if (locations[i] && locations[i].source) {
      return locations[i].source;
    }
  }
  return null;
}

/**
 * 提取 OpenAlex source 精简指标。
 */
function extractSourceMetrics_(source) {
  if (!source) {
    return {
      source_id: '',
      source_display_name: UNKNOWN_SOURCE,
      m2yr: null,
      h_index: null,
      i10_index: null,
      cited_by_count: null,
      works_count: null,
      source_type: '',
      issn_l: ''
    };
  }

  const stats = source.summary_stats || {};
  return {
    source_id: source.id || '',
    source_display_name: source.display_name || UNKNOWN_SOURCE,
    m2yr: toNullableNumber_(stats['2yr_mean_citedness']),
    h_index: toNullableNumber_(stats.h_index),
    i10_index: toNullableNumber_(stats.i10_index),
    cited_by_count: toNullableNumber_(source.cited_by_count),
    works_count: toNullableNumber_(source.works_count),
    source_type: source.type || '',
    issn_l: source.issn_l || ''
  };
}

/**
 * 判断 source 指标是否不完整。
 */
function isIncompleteSourceMetrics_(source) {
  return !source ||
    typeof source.m2yr !== 'number' ||
    typeof source.h_index !== 'number' ||
    typeof source.i10_index !== 'number';
}

/**
 * 合并 source 指标，完整对象优先。
 */
function mergeSourceMetrics_(baseSource, fetchedSource) {
  const result = {};
  Object.keys(baseSource || {}).forEach(function(key) {
    result[key] = baseSource[key];
  });
  Object.keys(fetchedSource || {}).forEach(function(key) {
    if (typeof fetchedSource[key] !== 'undefined' && fetchedSource[key] !== null && fetchedSource[key] !== '') {
      result[key] = fetchedSource[key];
    }
  });
  return result;
}

/**
 * OpenAlex ID 归一化。
 */
function normalizeOpenAlexId_(id) {
  return String(id || '')
    .replace(/^https?:\/\/openalex\.org\//i, '')
    .trim();
}

/**
 * 生成 work 缓存查询键。
 */
function getOpenAlexWorkCacheLookupKey_(paper) {
  const doi = extractDoi_(paper);
  if (doi) {
    return 'doi:' + doi;
  }
  return 'title:' + normalizeOpenAlexTitle_(paper && paper.title);
}

/**
 * 读取 OpenAlex 缓存。
 */
function readOpenAlexCache_(prefix, rawKey) {
  if (!rawKey) {
    return null;
  }
  const propertyName = makeOpenAlexCachePropertyName_(prefix, rawKey);
  const raw = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!raw) {
    return null;
  }

  try {
    const cached = JSON.parse(raw);
    if (!cached || !cached.fetched_at) {
      return null;
    }
    const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
    if (ageMs > CONFIG.OPENALEX.CACHE_DAYS * 24 * 60 * 60 * 1000) {
      return null;
    }
    return cached;
  } catch (err) {
    logSafeError_('OpenAlex 缓存解析失败：', err);
    return null;
  }
}

/**
 * 清理过期、损坏和超量的 OpenAlex 缓存属性。
 */
function pruneOpenAlexCaches_() {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const keysToDelete = getOpenAlexCachePropertyNamesToDelete_(scriptProperties.getProperties());
    keysToDelete.forEach(function(propertyName) {
      scriptProperties.deleteProperty(propertyName);
    });
  } catch (err) {
    logSafeError_('OpenAlex 缓存清理失败，继续执行本次任务：', err);
  }
}

/**
 * 计算需要删除的 OpenAlex 缓存属性名，便于独立测试清理规则。
 */
function getOpenAlexCachePropertyNamesToDelete_(properties, now, maxEntries) {
  const values = properties || {};
  const nowValue = now ? new Date(now).getTime() : Date.now();
  const maxAgeMs = CONFIG.OPENALEX.CACHE_DAYS * 24 * 60 * 60 * 1000;
  const limit = typeof maxEntries === 'number'
    ? maxEntries
    : CONFIG.OPENALEX.MAX_CACHE_ENTRIES;
  const validEntries = [];
  const keysToDelete = [];

  Object.keys(values).forEach(function(propertyName) {
    const isOpenAlexCache = propertyName.indexOf(OPENALEX_WORK_CACHE_PREFIX) === 0 ||
      propertyName.indexOf(OPENALEX_SOURCE_CACHE_PREFIX) === 0;
    if (!isOpenAlexCache) {
      return;
    }

    try {
      const cached = JSON.parse(values[propertyName]);
      const fetchedAt = cached && cached.fetched_at
        ? new Date(cached.fetched_at).getTime()
        : NaN;
      if (isNaN(fetchedAt) || nowValue - fetchedAt > maxAgeMs) {
        keysToDelete.push(propertyName);
        return;
      }
      validEntries.push({
        propertyName: propertyName,
        fetchedAt: fetchedAt
      });
    } catch (err) {
      keysToDelete.push(propertyName);
    }
  });

  validEntries.sort(function(a, b) {
    return a.fetchedAt - b.fetchedAt;
  });
  const excessCount = Math.max(0, validEntries.length - Math.max(0, limit));
  validEntries.slice(0, excessCount).forEach(function(entry) {
    keysToDelete.push(entry.propertyName);
  });

  return keysToDelete;
}

/**
 * 写入 OpenAlex 缓存。
 */
function writeOpenAlexCache_(prefix, rawKey, value) {
  if (!rawKey || !value) {
    return;
  }
  const propertyName = makeOpenAlexCachePropertyName_(prefix, rawKey);
  const cacheValue = {};
  Object.keys(value).forEach(function(key) {
    cacheValue[key] = value[key];
  });
  cacheValue.fetched_at = cacheValue.fetched_at || new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty(propertyName, JSON.stringify(cacheValue));
}

/**
 * 生成缓存属性名。
 */
function makeOpenAlexCachePropertyName_(prefix, rawKey) {
  return prefix + makeShortHash_(rawKey);
}

/**
 * 生成短哈希。
 */
function makeShortHash_(text) {
  return makeSha256Hex_(text).slice(0, 32);
}

/**
 * 生成完整 SHA-256 十六进制指纹。
 */
function makeSha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

/**
 * 安全数字转换。
 */
function toNullableNumber_(value) {
  const numberValue = Number(value);
  return isNaN(numberValue) ? null : numberValue;
}

/**
 * 读取最近的 Google Scholar Alert 邮件，并解析出候选论文。
 */
function fetchRecentScholarAlertPapers_() {
  const threads = GmailApp.search(CONFIG.GMAIL.SEARCH_QUERY, 0, CONFIG.GMAIL.MAX_THREADS);
  const messages = [];

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      messages.push(message);
    });
  });

  messages.sort(function(a, b) {
    return b.getDate().getTime() - a.getDate().getTime();
  });

  const recentMessages = messages.slice(0, CONFIG.GMAIL.MAX_EMAILS);
  const papers = [];

  recentMessages.forEach(function(message) {
    parseScholarPapersFromMessage_(message).forEach(function(paper) {
      papers.push(paper);
    });
  });

  return dedupePapers_(papers);
}

/**
 * 从单封邮件里解析论文条目。优先解析 HTML 链接，失败时使用纯文本兜底。
 */
function parseScholarPapersFromMessage_(message) {
  const html = message.getBody() || '';
  const plain = message.getPlainBody() || '';
  const anchors = extractPaperAnchors_(html);
  const papers = [];

  anchors.forEach(function(anchor) {
    const context = extractContextAfterAnchor_(html, anchor.endIndex);
    const meta = parseMetadataAndSnippet_(context.lines, anchor.title);
    papers.push({
      title: anchor.title,
      authors: meta.authors,
      source: meta.source,
      link: anchor.link,
      snippet: meta.snippet,
      emailSubject: message.getSubject(),
      emailDate: message.getDate()
    });
  });

  if (papers.length > 0) {
    return dedupePapers_(papers);
  }

  return parsePlainTextPapers_(plain, message);
}

/**
 * 从 HTML 中提取可能代表论文标题的链接。
 */
function extractPaperAnchors_(html) {
  const anchors = [];
  const anchorRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(html)) !== null) {
    const rawHref = decodeHtmlEntities_(match[2]);
    const title = normalizeTitle_(cleanHtmlText_(match[3]));
    const link = normalizeScholarLink_(rawHref);

    if (!isLikelyPaperAnchor_(title, link)) {
      continue;
    }

    anchors.push({
      title: title,
      link: link,
      startIndex: match.index,
      endIndex: anchorRegex.lastIndex
    });
  }

  return anchors;
}

/**
 * 提取标题链接后面的若干文本行，用来识别作者、来源和摘要片段。
 */
function extractContextAfterAnchor_(html, endIndex) {
  const windowHtml = html.substring(endIndex, Math.min(html.length, endIndex + 3000));
  return {
    lines: htmlToLines_(windowHtml)
  };
}

/**
 * 从标题后的文本行里解析作者、来源和摘要片段。
 */
function parseMetadataAndSnippet_(lines, title) {
  const cleanLines = lines.filter(function(line) {
    return line && !isHousekeepingLine_(line) && normalizeTitle_(line) !== normalizeTitle_(title);
  });

  let metadataLine = '';
  let metadataIndex = -1;

  for (let i = 0; i < cleanLines.length; i++) {
    if (looksLikeMetadataLine_(cleanLines[i])) {
      metadataLine = cleanLines[i];
      metadataIndex = i;
      break;
    }
  }

  const meta = splitMetadataLine_(metadataLine);
  const snippetLines = cleanLines
    .slice(metadataIndex >= 0 ? metadataIndex + 1 : 0)
    .filter(function(line) {
      return !looksLikeMetadataLine_(line) && !containsUrl_(line);
    })
    .slice(0, 3);

  return {
    authors: meta.authors || 'Unknown',
    source: meta.source || 'Unknown',
    snippet: limitText_(snippetLines.join(' '), CONFIG.MAX_SNIPPET_LENGTH)
  };
}

/**
 * 纯文本兜底解析。不同邮件模板差异较大，所以这里只做保守提取。
 */
function parsePlainTextPapers_(plain, message) {
  const lines = plainToLines_(plain);
  const papers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeTitle_(lines[i]);
    if (!isLikelyTitleLine_(line)) {
      continue;
    }

    const nextLines = lines.slice(i + 1, i + 8);
    const link = findFirstUrl_(nextLines.join(' '));
    const metadataLine = nextLines.filter(function(nextLine) {
      return looksLikeMetadataLine_(nextLine);
    })[0] || '';
    const meta = splitMetadataLine_(metadataLine);
    const snippet = nextLines
      .filter(function(nextLine) {
        return nextLine !== metadataLine && !containsUrl_(nextLine) && !isHousekeepingLine_(nextLine);
      })
      .slice(0, 3)
      .join(' ');

    papers.push({
      title: line,
      authors: meta.authors || 'Unknown',
      source: meta.source || 'Unknown',
      link: link,
      snippet: limitText_(snippet, CONFIG.MAX_SNIPPET_LENGTH),
      emailSubject: message.getSubject(),
      emailDate: message.getDate()
    });
  }

  return dedupePapers_(papers);
}

/**
 * 针对某个研究方向选择匹配度最高且未推送过的一篇论文。
 */
function selectBestPaperForDirection_(papers, direction, pushedKeys, reservedKeys) {
  const scored = [];

  papers.forEach(function(paper) {
    const paperKey = makePaperKey_(paper);
    if (!paperKey || pushedKeys.indexOf(paperKey) !== -1 || reservedKeys[paperKey]) {
      return;
    }

    const score = scorePaperForDirection_(paper, direction);
    if (score.total <= 0) {
      return;
    }

    scored.push({
      title: paper.title,
      authors: paper.authors,
      source: paper.source,
      link: paper.link,
      doi: paper.doi || (paper.openalex && paper.openalex.doi) || '',
      snippet: paper.snippet,
      emailDate: paper.emailDate,
      publicationDate: getPublicationDate_(paper),
      publicationYear: paper.publicationYear || (paper.openalex && paper.openalex.publication_year) || null,
      cited_by_count: typeof paper.cited_by_count === 'number'
        ? paper.cited_by_count
        : paper.openalex && paper.openalex.cited_by_count,
      dataSource: paper.dataSource || '',
      openalex: paper.openalex || null,
      paperKey: paperKey,
      score: score.total,
      relatedness_score: score.total,
      citation_score: typeof paper.citation_score === 'number' ? paper.citation_score : 0,
      matchedKeywords: score.matchedKeywords,
      whyRecommended: buildReason_(score.matchedKeywords, score.total)
    });
  });

  computeCitationScores_(scored);
  applyVenueQualityScores_(scored, direction);
  applyFinalScores_(scored);
  scored.forEach(function(paper) {
    paper.whyRecommended = buildReason_(paper.matchedKeywords, paper.score, paper);
  });
  const hasOpenAlexSignal = hasUsableOpenAlexSignal_(scored);

  scored.sort(function(a, b) {
    if (!hasOpenAlexSignal) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return safeDateValue_(b.emailDate) - safeDateValue_(a.emailDate);
    }
    if (a.OA_Q1_PROXY !== b.OA_Q1_PROXY) {
      return a.OA_Q1_PROXY ? -1 : 1;
    }
    if (b.final_score !== a.final_score) {
      return b.final_score - a.final_score;
    }
    if (b.relatedness_score !== a.relatedness_score) {
      return b.relatedness_score - a.relatedness_score;
    }
    return safeDateValue_(b.emailDate) - safeDateValue_(a.emailDate);
  });

  return scored.length > 0 ? scored[0] : null;
}

/**
 * 判断当前候选中是否有可用 OpenAlex 信号。
 */
function hasUsableOpenAlexSignal_(papers) {
  return papers.some(function(paper) {
    if (!paper.openalex || paper.openalex.error_note) {
      return false;
    }
    return !!paper.openalex.source_id ||
      typeof paper.openalex.m2yr === 'number' ||
      typeof paper.openalex.h_index === 'number' ||
      typeof paper.openalex.i10_index === 'number';
  });
}

/**
 * 按标题、摘要和来源中的关键词命中情况打分。
 */
function scorePaperForDirection_(paper, direction) {
  const title = normalizeForMatch_(paper.title);
  const snippet = normalizeForMatch_(paper.snippet);
  const source = normalizeForMatch_(paper.source);
  const matched = [];
  let total = 0;

  direction.keywords.forEach(function(keyword) {
    const normalizedKeyword = normalizeForMatch_(keyword);
    let keywordScore = 0;

    if (title.indexOf(normalizedKeyword) !== -1) {
      keywordScore += 5;
    }
    if (snippet.indexOf(normalizedKeyword) !== -1) {
      keywordScore += 3;
    }
    if (source.indexOf(normalizedKeyword) !== -1) {
      keywordScore += 1;
    }

    if (keywordScore > 0) {
      total += keywordScore;
      matched.push(keyword);
    }
  });

  return {
    total: total,
    matchedKeywords: matched
  };
}

/**
 * 给某个方向的一组候选文献计算 OpenAlex 来源质量分和 OA-Q1 proxy 标记。
 */
function applyVenueQualityScores_(papers, direction) {
  const p2yr = computePercentiles_(papers, 'm2yr');
  const ph = computePercentiles_(papers, 'h_index');
  const pi10 = computePercentiles_(papers, 'i10_index');

  papers.forEach(function(paper, index) {
    const sourceName = getPaperVenueName_(paper);
    const whitelistBonus = isHighQualitySource_(sourceName, direction.id) ? 1 : 0;
    paper.whitelist_bonus = whitelistBonus;
    paper.P_2yr = p2yr[index] || 0;
    paper.P_h = ph[index] || 0;
    paper.P_i10 = pi10[index] || 0;

    if (typeof paper.venue_quality_score !== 'number') {
      paper.venue_quality_score = clampScore_(
        0.60 * paper.P_2yr +
        0.30 * paper.P_h +
        0.10 * paper.P_i10
      );
    }

    if (whitelistBonus && paper.venue_quality_score < 0.85 && papers.length < 5) {
      paper.venue_quality_score = 0.85;
    }
  });

  markOAQ1Proxy_(papers, direction);
  return papers;
}

/**
 * 计算指定 OpenAlex 指标在当前方向候选内部的百分位。
 */
function computePercentiles_(papers, metricName) {
  const values = papers.map(function(paper) {
    return getOpenAlexMetric_(paper, metricName);
  });
  const validValues = values.filter(function(value) {
    return typeof value === 'number' && !isNaN(value);
  }).sort(function(a, b) {
    return a - b;
  });

  return values.map(function(value) {
    if (typeof value !== 'number' || isNaN(value)) {
      return 0;
    }
    if (validValues.length <= 1) {
      return 1;
    }

    let lowerCount = 0;
    validValues.forEach(function(candidate) {
      if (candidate < value) {
        lowerCount++;
      }
    });
    return clampScore_(lowerCount / (validValues.length - 1));
  });
}

/**
 * 公开测试入口：计算指标百分位。
 */
function computePercentiles(papers, metricName) {
  return computePercentiles_(papers, metricName);
}

/**
 * 在方向内部标记 OA-Q1 proxy。
 */
function markOAQ1Proxy_(papers, direction) {
  papers.forEach(function(paper) {
    paper.OA_Q1_PROXY = false;
  });

  if (!papers.length) {
    return papers;
  }

  if (papers.length < 5) {
    papers.forEach(function(paper) {
      const sourceName = getPaperVenueName_(paper);
      paper.OA_Q1_PROXY = paper.venue_quality_score >= 0.75 || isHighQualitySource_(sourceName, direction.id);
    });
    return papers;
  }

  const ranked = papers.slice().sort(function(a, b) {
    return (b.venue_quality_score || 0) - (a.venue_quality_score || 0);
  });
  const topCount = Math.max(1, Math.ceil(papers.length * 0.25));
  const proxyKeys = {};

  ranked.slice(0, topCount).forEach(function(paper) {
    if ((paper.venue_quality_score || 0) > 0 || paper.whitelist_bonus) {
      proxyKeys[paper.paperKey || paper.link || paper.title] = true;
    }
  });

  papers.forEach(function(paper) {
    paper.OA_Q1_PROXY = !!proxyKeys[paper.paperKey || paper.link || paper.title];
  });
  return papers;
}

/**
 * 公开测试入口：标记 OA-Q1 proxy。
 */
function markOAQ1Proxy(papers, direction) {
  return markOAQ1Proxy_(papers, direction);
}

/**
 * 计算最终综合分。
 */
function applyFinalScores_(papers) {
  const maxRelatedness = Math.max.apply(null, papers.map(function(paper) {
    return paper.relatedness_score || paper.score || 0;
  }).concat([0]));
  const activeSearchRange = getFiveYearDateRange_();
  const dateValues = papers.map(function(paper) {
    return safeDateValue_(paper.emailDate);
  }).filter(function(value) {
    return value > 0;
  });
  const minDate = dateValues.length ? Math.min.apply(null, dateValues) : 0;
  const maxDate = dateValues.length ? Math.max.apply(null, dateValues) : 0;

  papers.forEach(function(paper) {
    paper.relatedness_score_norm = maxRelatedness > 0
      ? clampScore_((paper.relatedness_score || paper.score || 0) / maxRelatedness)
      : 0;
    const publicationDate = paper.publicationDate && paper.publicationDate !== 'Unknown'
      ? paper.publicationDate
      : paper.openalex && paper.openalex.publication_date || '';
    const publicationYear = paper.publicationYear || paper.openalex && paper.openalex.publication_year || null;

    if (publicationDate || publicationYear) {
      paper.freshness_score = computeFreshnessScore_(
        publicationDate,
        activeSearchRange.fromDate,
        activeSearchRange.toDate,
        publicationYear
      );
    } else {
      paper.freshness_score = computeRelativeFreshnessScore_(paper.emailDate, minDate, maxDate);
    }

    if (typeof paper.citation_score !== 'number' || isNaN(paper.citation_score)) {
      paper.citation_score = 0;
    }
    paper.final_score = clampScore_(
      0.45 * paper.relatedness_score_norm +
      0.35 * (paper.venue_quality_score || 0) +
      0.15 * paper.citation_score +
      0.05 * paper.freshness_score
    );
  });

  return papers;
}

/**
 * 读取文献上的 OpenAlex 指标。
 */
function getOpenAlexMetric_(paper, metricName) {
  if (!paper || !paper.openalex) {
    return null;
  }
  const value = paper.openalex[metricName];
  return typeof value === 'number' && !isNaN(value) ? value : null;
}

/**
 * 计算主动检索文献在近五年窗口内的新鲜度分数。
 */
function computeFreshnessScore_(publicationDate, fromDate, toDate, publicationYear) {
  const date = parseDateForScoring_(publicationDate, publicationYear);
  const from = parseDateForScoring_(fromDate, null);
  const to = parseDateForScoring_(toDate, null);
  const value = safeDateValue_(date);
  const minDate = safeDateValue_(from);
  const maxDate = safeDateValue_(to);
  if (!value || !minDate || !maxDate) {
    return 0;
  }
  if (minDate === maxDate) {
    return 1;
  }
  return clampScore_((value - minDate) / (maxDate - minDate));
}

/**
 * 计算 Gmail Scholar Alert 候选在同批邮件中的相对新鲜度分数。
 */
function computeRelativeFreshnessScore_(date, minDate, maxDate) {
  const value = safeDateValue_(date);
  if (!value) {
    return 0;
  }
  if (!minDate || !maxDate || minDate === maxDate) {
    return 1;
  }
  return clampScore_((value - minDate) / (maxDate - minDate));
}

/**
 * 返回文献来源名，优先使用 OpenAlex source_display_name。
 */
function getPaperVenueName_(paper) {
  if (paper && paper.openalex && paper.openalex.source_display_name) {
    return paper.openalex.source_display_name;
  }
  return paper && paper.source ? paper.source : UNKNOWN_SOURCE;
}

/**
 * 判断来源是否命中对应方向的高质量白名单。
 */
function isHighQualitySource_(sourceName, directionId) {
  const normalized = normalizeSourceName_(sourceName);
  if (!normalized) {
    return false;
  }

  const canonical = HIGH_QUALITY_SOURCE_ALIASES[normalized] || sourceName;
  const canonicalNormalized = normalizeSourceName_(canonical);
  const configuredList = HIGH_QUALITY_SOURCE_WHITE_LIST[directionId];
  const list = Array.isArray(configuredList) ? configuredList : [];
  return list.some(function(item) {
    return normalizeSourceName_(item) === canonicalNormalized || normalizeSourceName_(item) === normalized;
  });
}

/**
 * 来源名归一化，用于白名单和别名匹配。
 */
function normalizeSourceName_(name) {
  return normalizeOpenAlexTitle_(name);
}

/**
 * OpenAlex 标题归一化：忽略大小写、标点和多余空格。
 */
function normalizeOpenAlexTitle_(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 公开测试入口：标题归一化。
 */
function normalizeTitle(title) {
  return normalizeOpenAlexTitle_(title);
}

/**
 * 计算两个标题的简单相似度，结合 token overlap 和字符相似度。
 */
function computeTitleSimilarity_(a, b) {
  const left = normalizeOpenAlexTitle_(a);
  const right = normalizeOpenAlexTitle_(b);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }

  const leftTokens = uniqueTokens_(left);
  const rightTokens = uniqueTokens_(right);
  const tokenScore = jaccardSimilarity_(leftTokens, rightTokens);
  const charScore = normalizedCharacterSimilarity_(left, right);
  return clampScore_(0.70 * tokenScore + 0.30 * charScore);
}

/**
 * 提取唯一 token。
 */
function uniqueTokens_(text) {
  const seen = {};
  const result = [];
  String(text || '').split(/\s+/).forEach(function(token) {
    if (token && !seen[token]) {
      seen[token] = true;
      result.push(token);
    }
  });
  return result;
}

/**
 * 计算 Jaccard 相似度。
 */
function jaccardSimilarity_(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }
  const rightSet = {};
  rightTokens.forEach(function(token) {
    rightSet[token] = true;
  });

  let intersection = 0;
  leftTokens.forEach(function(token) {
    if (rightSet[token]) {
      intersection++;
    }
  });
  const union = leftTokens.length + rightTokens.length - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * 基于最长公共子序列的字符相似度。
 */
function normalizedCharacterSimilarity_(left, right) {
  const lcs = longestCommonSubsequenceLength_(left, right);
  return (2 * lcs) / (left.length + right.length);
}

/**
 * 计算最长公共子序列长度。
 */
function longestCommonSubsequenceLength_(left, right) {
  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      if (left.charAt(i - 1) === right.charAt(j - 1)) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(previous[j], current[j - 1]);
      }
    }
    for (let k = 0; k <= right.length; k++) {
      previous[k] = current[k];
      current[k] = 0;
    }
  }

  return previous[right.length];
}

/**
 * 限制分数在 0 到 1。
 */
function clampScore_(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * 获取论文发表日期。
 */
function getPublicationDate_(paper) {
  if (paper && paper.openalex && paper.openalex.publication_date) {
    return paper.openalex.publication_date;
  }
  if (paper && paper.emailDate && typeof paper.emailDate.getTime === 'function') {
    return Utilities.formatDate(paper.emailDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return 'Unknown';
}

/**
 * 生成飞书文本消息。
 */
function buildFeishuMessage_(selections, parsedCount, options) {
  const messageOptions = options || {};
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const parts = [messageOptions.title || 'Google Scholar Alert 今日英文文献推荐'];
  if (messageOptions.notice) {
    parts.push(messageOptions.notice);
  }
  parts.push(
    '日期：' + today,
    '候选解析数：' + parsedCount,
    'Data Source: ' + (messageOptions.sourceDescription || 'Google Scholar Alert, with optional OpenAlex enrichment.'),
    ''
  );

  selections.forEach(function(selection) {
    parts.push('【' + selection.direction.label + '】');

    if (!selection.paper) {
      parts.push('今日未检索到合适文献。');
      parts.push(messageOptions.noResultReason || '可能原因：近期没有可用候选、关键词匹配不足，或候选论文已经推送过。');
      parts.push('');
      return;
    }

    const venueName = getPaperVenueName_(selection.paper);
    parts.push('Direction: ' + selection.direction.label);
    parts.push('Title: ' + selection.paper.title);
    parts.push('Authors: ' + selection.paper.authors);
    parts.push('Source / Venue: ' + venueName);
    parts.push('Publication Date: ' + (selection.paper.publicationDate || getPublicationDate_(selection.paper)));
    if (selection.paper.doi || selection.paper.openalex && selection.paper.openalex.doi) {
      parts.push('DOI: ' + (selection.paper.doi || selection.paper.openalex.doi));
    }
    parts.push('Link: ' + (selection.paper.link || 'Unknown'));
    parts.push('Relatedness Score: ' + formatScore_(selection.paper.relatedness_score_norm));
    parts.push('Venue Quality Score: ' + formatScore_(selection.paper.venue_quality_score));
    parts.push('Citation Score: ' + formatScore_(selection.paper.citation_score));
    parts.push('Freshness Score: ' + formatScore_(selection.paper.freshness_score));
    parts.push('Final Score: ' + formatScore_(selection.paper.final_score));
    parts.push('OA-Q1 Proxy: ' + (selection.paper.OA_Q1_PROXY ? 'Yes' : 'No'));
    parts.push('Why recommended:');
    parts.push(selection.paper.whyRecommended);
    if (selection.paper.snippet) {
      parts.push('摘要片段：' + selection.paper.snippet);
    }
    parts.push('OpenAlex Metrics: ' + formatOpenAlexMetrics_(selection.paper.openalex));
    parts.push('Note:');
    parts.push(buildOpenAlexNote_(selection.paper.openalex));
    parts.push('');
  });

  return parts.join('\n');
}

/**
 * 格式化分数。
 */
function formatScore_(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return 'N/A';
  }
  return score.toFixed(2);
}

/**
 * 格式化 OpenAlex 指标。
 */
function formatOpenAlexMetrics_(openalex) {
  if (!openalex) {
    return 'Unavailable';
  }
  return [
    '2yr_mean_citedness=' + formatMetric_(openalex.m2yr),
    'h_index=' + formatMetric_(openalex.h_index),
    'i10_index=' + formatMetric_(openalex.i10_index),
    'cited_by_count=' + formatMetric_(openalex.cited_by_count),
    'works_count=' + formatMetric_(openalex.works_count),
    'type=' + (openalex.source_type || 'Unknown')
  ].join('; ');
}

/**
 * 格式化单个指标。
 */
function formatMetric_(value) {
  if (typeof value === 'number' && !isNaN(value)) {
    return String(value);
  }
  return 'N/A';
}

/**
 * 生成 OpenAlex 说明。
 */
function buildOpenAlexNote_(openalex) {
  const notes = [
    'OA-Q1 proxy is based on OpenAlex metrics and is not official JCR quartile.'
  ];
  if (!openalex) {
    notes.push('OpenAlex enrichment unavailable; recommendation may rely on keyword relatedness only.');
  } else if (openalex.error_note) {
    notes.push(openalex.error_note);
  }
  return notes.join(' ');
}

/**
 * 推送纯文本消息到飞书群机器人。
 */
function postFeishuText_(text) {
  const webhook = getConfiguredValue_(PROP_FEISHU_WEBHOOK, CONFIG.FEISHU_WEBHOOK);
  if (!isUsableFeishuWebhook_(webhook)) {
    throw new Error('请先在 CONFIG.FEISHU_WEBHOOK 或脚本属性 FEISHU_WEBHOOK 中配置有效的 HTTPS 飞书 Webhook。');
  }

  const payload = {
    msg_type: 'text',
    content: {
      text: text
    }
  };

  const signSecret = getConfiguredValue_(PROP_FEISHU_SIGN_SECRET, CONFIG.FEISHU_SIGN_SECRET);
  if (signSecret) {
    const signed = makeFeishuSign_(signSecret);
    payload.timestamp = signed.timestamp;
    payload.sign = signed.sign;
  }

  let response;
  try {
    response = UrlFetchApp.fetch(webhook, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    throw new Error(sanitizeErrorForLog_(err));
  }

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(sanitizeErrorForLog_('飞书推送失败，HTTP 状态码：' + status + '，响应：' + body));
  }

  let feishuCode = null;
  try {
    const json = JSON.parse(body);
    feishuCode = typeof json.code !== 'undefined' ? json.code : null;
    if (typeof json.code !== 'undefined' && json.code !== 0) {
      throw new Error(sanitizeErrorForLog_('飞书返回错误：' + body));
    }
  } catch (err) {
    if (String(err).indexOf('飞书返回错误') !== -1) {
      throw err;
    }
  }

  return {
    httpStatus: status,
    feishuCode: feishuCode
  };
}

/**
 * 生成飞书签名校验字段。
 */
function makeFeishuSign_(secret) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const stringToSign = timestamp + '\n' + secret;
  const signatureBytes = Utilities.computeHmacSha256Signature('', stringToSign);
  return {
    timestamp: timestamp,
    sign: Utilities.base64Encode(signatureBytes)
  };
}

/**
 * 获取脚本属性或配置区中的值。脚本属性优先级更高。
 */
function getConfiguredValue_(propertyName, configValue) {
  const propertyValue = PropertiesService.getScriptProperties().getProperty(propertyName);
  return String(propertyValue || configValue || '').trim();
}

/**
 * 判断 Webhook 是否为可请求的 HTTPS 地址。
 */
function isUsableFeishuWebhook_(webhook) {
  const value = String(webhook || '').trim();
  return value !== 'PASTE_YOUR_FEISHU_WEBHOOK_HERE' && /^https:\/\/\S+$/i.test(value);
}

/**
 * 从错误日志中移除脚本属性凭证和常见的带凭证 URL。
 */
function sanitizeErrorForLog_(err) {
  const original = err && err.stack ? err.stack : err;
  let message = String(original || 'Unknown error');
  message = message
    .replace(/([?&]api_key=)[^&\s"'<>]+/gi, '$1[REDACTED]')
    .replace(/https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9_-]+/gi, '[REDACTED_FEISHU_WEBHOOK]');

  try {
    const properties = PropertiesService.getScriptProperties();
    [PROP_OPENALEX_API_KEY, PROP_FEISHU_WEBHOOK, PROP_FEISHU_SIGN_SECRET].forEach(function(propertyName) {
      const secret = String(properties.getProperty(propertyName) || '').trim();
      if (secret) {
        message = message.split(secret).join('[REDACTED]');
      }
    });
  } catch (ignored) {
    // 日志脱敏本身不能掩盖原始错误。
  }
  return message;
}

/**
 * 记录已脱敏的错误。
 */
function logSafeError_(prefix, err) {
  Logger.log(String(prefix || '') + sanitizeErrorForLog_(err));
}

/**
 * 读取用户自定义研究方向。属性缺失或为空时保留内置默认方向。
 */
function getConfiguredDirections_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_LITERATURE_DIRECTIONS_JSON);
  return parseConfiguredDirections_(raw, CONFIG.DIRECTIONS);
}

/**
 * 解析并校验研究方向 JSON。显式配置无效时直接报错，避免推送错误主题。
 */
function parseConfiguredDirections_(raw, defaultDirections) {
  if (raw === null || typeof raw === 'undefined' || String(raw).trim() === '') {
    return defaultDirections;
  }

  const text = String(raw).trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 不是有效 JSON。');
  }

  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_CUSTOM_DIRECTIONS) {
    throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 必须是包含 1-' + MAX_CUSTOM_DIRECTIONS + ' 个方向的数组。');
  }

  const seenIds = Object.create(null);
  return parsed.map(function(direction, index) {
    if (!direction || typeof direction !== 'object' || Array.isArray(direction)) {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 第 ' + (index + 1) + ' 个方向必须是对象。');
    }

    if (typeof direction.id !== 'string') {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 第 ' + (index + 1) + ' 个方向的 id 必须是字符串。');
    }
    const id = direction.id.trim();
    if (!id || id.length > MAX_DIRECTION_ID_LENGTH || !/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 第 ' + (index + 1) + ' 个方向的 id 无效。');
    }
    if (seenIds[id]) {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 包含重复 id：' + id + '。');
    }
    seenIds[id] = true;

    if (typeof direction.label !== 'string') {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 方向 ' + id + ' 的 label 必须是字符串。');
    }
    const label = direction.label.trim();
    if (!label || label.length > MAX_DIRECTION_LABEL_LENGTH) {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 方向 ' + id + ' 的 label 必须为 1-' + MAX_DIRECTION_LABEL_LENGTH + ' 个字符。');
    }

    const keywords = normalizeDirectionKeywords_(
      direction.keywords,
      id + '.keywords',
      MAX_SCORING_KEYWORDS
    );
    const activeSearchKeywords = typeof direction.activeSearchKeywords === 'undefined'
      ? keywords.slice(0, MAX_ACTIVE_SEARCH_KEYWORDS)
      : normalizeDirectionKeywords_(
        direction.activeSearchKeywords,
        id + '.activeSearchKeywords',
        MAX_ACTIVE_SEARCH_KEYWORDS
      );
    activeSearchKeywords.forEach(function(keyword) {
      if (/[,\u0000-\u001f\u007f]/.test(keyword)) {
        throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 中 ' + id + '.activeSearchKeywords 不能包含逗号或控制字符。');
      }
    });
    return {
      id: id,
      label: label,
      activeSearchKeywords: activeSearchKeywords,
      keywords: keywords
    };
  });
}

/**
 * 校验、去空白并按大小写不敏感方式去重关键词。
 */
function normalizeDirectionKeywords_(value, fieldName, maxItems) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) {
    throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 中 ' + fieldName + ' 必须包含 1-' + maxItems + ' 个关键词。');
  }

  const seen = Object.create(null);
  const normalized = [];
  value.forEach(function(item) {
    if (typeof item !== 'string') {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 中 ' + fieldName + ' 只能包含字符串。');
    }
    const keyword = item.trim();
    if (!keyword || keyword.length > MAX_KEYWORD_LENGTH) {
      throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 中 ' + fieldName + ' 的关键词长度必须为 1-' + MAX_KEYWORD_LENGTH + '。');
    }
    const key = keyword.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      normalized.push(keyword);
    }
  });

  if (!normalized.length) {
    throw new Error(PROP_LITERATURE_DIRECTIONS_JSON + ' 中 ' + fieldName + ' 不能为空。');
  }
  return normalized;
}

/**
 * 在正式推送或创建触发器前检查必需配置，不输出任何凭证值。
 */
function assertLiteratureRadarRuntimeConfig_() {
  const directions = getConfiguredDirections_();
  const apiKey = getConfiguredValue_(PROP_OPENALEX_API_KEY, '');
  const webhook = getConfiguredValue_(PROP_FEISHU_WEBHOOK, CONFIG.FEISHU_WEBHOOK);
  if (!apiKey) {
    throw new Error('未配置 OpenAlex API Key，已停止 Literature Radar。');
  }
  if (!isUsableFeishuWebhook_(webhook)) {
    throw new Error('未配置有效的 HTTPS 飞书 Webhook，已停止 Literature Radar。');
  }
  return {
    directions: directions,
    apiKey: apiKey
  };
}

/**
 * 输出不含凭证的当前配置摘要，便于安装后检查。
 */
function validateLiteratureRadarConfig() {
  const properties = PropertiesService.getScriptProperties();
  const directions = getConfiguredDirections_();
  const summary = {
    directionCount: directions.length,
    directions: directions.map(function(direction) {
      return {
        id: direction.id,
        label: direction.label,
        activeSearchKeywordCount: direction.activeSearchKeywords.length,
        scoringKeywordCount: direction.keywords.length
      };
    }),
    openAlexApiKeyConfigured: !!String(properties.getProperty(PROP_OPENALEX_API_KEY) || '').trim(),
    feishuWebhookConfigured: isUsableFeishuWebhook_(
      getConfiguredValue_(PROP_FEISHU_WEBHOOK, CONFIG.FEISHU_WEBHOOK)
    ),
    timezone: CONFIG.TIMEZONE,
    schedule: 'every 2 days at approximately 07:30'
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * 读取历史推送指纹。
 */
function getPushedKeys_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_PUSHED_KEYS);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logSafeError_('历史推送记录解析失败，将从空记录开始：', err);
    return [];
  }
}

/**
 * 推送成功后保存本次选中的论文指纹。
 */
function savePushedSelections_(pushedKeys, selections) {
  const nextKeys = pushedKeys.slice();

  selections.forEach(function(selection) {
    if (selection.paper && selection.paper.paperKey && nextKeys.indexOf(selection.paper.paperKey) === -1) {
      nextKeys.unshift(selection.paper.paperKey);
    }
  });

  const trimmed = nextKeys.slice(0, CONFIG.MAX_PUSHED_KEYS);
  PropertiesService.getScriptProperties().setProperty(PROP_PUSHED_KEYS, JSON.stringify(trimmed));
}

/**
 * 安全保存推送指纹；保存失败只记录日志，不影响已经成功发送的消息。
 */
function savePushedSelectionsSafely_(pushedKeys, selections) {
  try {
    savePushedSelections_(pushedKeys, selections);
  } catch (err) {
    logSafeError_('推送已成功，但保存文献去重记录失败：', err);
  }
}

/**
 * 生成论文去重指纹。优先 DOI，其次 OpenAlex work ID，最后标题。
 */
function makePaperKey_(paper) {
  const doi = normalizeDoi_(
    paper && paper.doi ||
    paper && paper.openalex && paper.openalex.doi ||
    extractDoi_(paper)
  );
  const openAlexWorkId = paper && paper.openalex && paper.openalex.openalex_work_id
    ? normalizeOpenAlexId_(paper.openalex.openalex_work_id)
    : '';
  const title = normalizeForMatch_(paper && paper.title || '');
  const raw = doi
    ? 'doi:' + doi
    : openAlexWorkId
      ? 'openalex:' + openAlexWorkId
      : title
        ? 'title:' + title
        : normalizeForMatch_(paper && paper.link || '');
  if (!raw) {
    return '';
  }

  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

/**
 * 对解析出的候选论文做去重。
 */
function dedupePapers_(papers) {
  const seen = {};
  const result = [];

  papers.forEach(function(paper) {
    if (!paper.title || paper.title.length < 8) {
      return;
    }

    const key = normalizeForMatch_(paper.link || paper.title);
    if (!key || seen[key]) {
      return;
    }

    seen[key] = true;
    result.push(paper);
  });

  return result;
}

/**
 * 将 Google Scholar 跳转链接尽量还原成论文原始链接。
 */
function normalizeScholarLink_(href) {
  if (!href) {
    return '';
  }

  let link = href.replace(/&amp;/g, '&');
  const urlMatch = link.match(/[?&]url=([^&]+)/i);
  if (urlMatch && urlMatch[1]) {
    try {
      return decodeURIComponent(urlMatch[1]);
    } catch (err) {
      return urlMatch[1];
    }
  }

  if (link.indexOf('//') === 0) {
    link = 'https:' + link;
  }

  return link;
}

/**
 * 判断 HTML 链接是否像论文标题链接。
 */
function isLikelyPaperAnchor_(title, link) {
  if (!isLikelyTitleLine_(title)) {
    return false;
  }

  if (!link || link.indexOf('http') !== 0) {
    return false;
  }

  const lowerLink = link.toLowerCase();
  if (
    lowerLink.indexOf('accounts.google') !== -1 ||
    lowerLink.indexOf('support.google') !== -1 ||
    lowerLink.indexOf('unsubscribe') !== -1 ||
    lowerLink.indexOf('/citations?') !== -1
  ) {
    return false;
  }

  return true;
}

/**
 * 判断一行文本是否像论文标题。
 */
function isLikelyTitleLine_(line) {
  if (!line || line.length < 8 || line.length > 260) {
    return false;
  }

  if (containsUrl_(line) || isHousekeepingLine_(line)) {
    return false;
  }

  return /[a-zA-Z]/.test(line) && line.split(/\s+/).length >= 3;
}

/**
 * 判断一行文本是否像作者与来源信息。
 */
function looksLikeMetadataLine_(line) {
  if (!line || isHousekeepingLine_(line) || containsUrl_(line)) {
    return false;
  }

  if (line.indexOf(' - ') !== -1) {
    return true;
  }

  return /^[A-Z][A-Za-z .,'-]+,\s*[A-Z]/.test(line);
}

/**
 * 拆分作者和来源。Google Scholar 常见格式为 “作者 - 期刊/来源 - 年份/网站”。
 */
function splitMetadataLine_(line) {
  if (!line) {
    return {
      authors: '',
      source: ''
    };
  }

  const parts = line.split(/\s+-\s+/).map(function(part) {
    return part.trim();
  }).filter(Boolean);

  if (parts.length === 0) {
    return {
      authors: line,
      source: ''
    };
  }

  return {
    authors: parts[0] || line,
    source: parts.slice(1).join(' - ')
  };
}

/**
 * 生成推荐理由。
 */
function buildReason_(matchedKeywords, score, paper) {
  if (!matchedKeywords || matchedKeywords.length === 0) {
    return '该文献与当前方向存在潜在相关性，但未命中显式关键词。';
  }

  const reasons = [
    '标题、摘要或来源命中关键词：' + matchedKeywords.slice(0, 6).join(', ')
  ];
  if (paper && paper.OA_Q1_PROXY) {
    reasons.push('来源被标记为 OA-Q1 proxy');
  } else if (paper && paper.venue_quality_score > 0) {
    reasons.push('来源质量分为 ' + formatScore_(paper.venue_quality_score));
  }
  if (paper && typeof paper.final_score === 'number') {
    reasons.push('最终综合分为 ' + formatScore_(paper.final_score));
  } else {
    reasons.push('关键词匹配分为 ' + score);
  }
  return reasons.join('；') + '。';
}

/**
 * 将 HTML 转成清洗后的文本。
 */
function cleanHtmlText_(html) {
  return decodeHtmlEntities_(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

/**
 * 将 HTML 转成文本行。
 */
function htmlToLines_(html) {
  const text = decodeHtmlEntities_(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/h\d|\/li|tr|\/tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  return plainToLines_(text);
}

/**
 * 将纯文本转成清洗后的文本行。
 */
function plainToLines_(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(function(line) {
      return line.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}

/**
 * 解码常见 HTML 实体。
 */
function decodeHtmlEntities_(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, function(_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);/g, function(_, code) {
      return String.fromCharCode(parseInt(code, 10));
    });
}

/**
 * 标准化标题文本。
 */
function normalizeTitle_(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
}

/**
 * 标准化匹配文本。
 */
function normalizeForMatch_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 判断是否为邮件模板中的功能性文本。
 */
function isHousekeepingLine_(line) {
  const lower = normalizeForMatch_(line);
  const blockedContains = [
    'google scholar',
    'view all',
    'all versions',
    'cited by',
    'related articles',
    'create alert',
    'cancel alert',
    'unsubscribe',
    'settings',
    'alerts',
    'this alert',
    'mark as irrelevant'
  ];
  const blockedExact = [
    'save',
    'pdf',
    'html'
  ];

  return blockedExact.indexOf(lower) !== -1 || blockedContains.some(function(item) {
    return lower.indexOf(item) !== -1;
  });
}

/**
 * 判断文本中是否包含 URL。
 */
function containsUrl_(text) {
  return /https?:\/\/\S+/i.test(String(text || ''));
}

/**
 * 查找文本中的第一个 URL。
 */
function findFirstUrl_(text) {
  const match = String(text || '').match(/https?:\/\/\S+/i);
  if (!match) {
    return '';
  }

  return normalizeScholarLink_(match[0].replace(/[)>.,;]+$/, ''));
}

/**
 * 限制文本长度。
 */
function limitText_(text, maxLength) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.substring(0, maxLength - 3) + '...';
}

/**
 * 安全获取日期时间戳。
 */
function safeDateValue_(date) {
  return date && typeof date.getTime === 'function' ? date.getTime() : 0;
}
