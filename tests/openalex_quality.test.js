const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCode(options) {
  const settings = options || {};
  const codePath = path.join(__dirname, '..', 'Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');
  const propertyValues = Object.assign({}, settings.properties || {});
  const logs = [];
  const triggers = (settings.triggers || []).map(function(trigger) {
    return makeMockTrigger(trigger);
  });
  const createdTriggerSpecs = [];
  const deletedTriggerHandlers = [];
  const sandbox = {
    console,
    Logger: { log: function(value) { logs.push(String(value)); } },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: function(_algorithm, text) {
        return Array.from(crypto.createHash('sha256').update(String(text)).digest()).map(function(byte) {
          return byte > 127 ? byte - 256 : byte;
        });
      },
      computeHmacSha256Signature: function() { return [1, 2, 3]; },
      base64Encode: function() { return 'signature'; },
      formatDate: function(date) { return date.toISOString().slice(0, 10); }
    },
    PropertiesService: {
      getScriptProperties: function() {
        return {
          getProperty: function(name) {
            return Object.prototype.hasOwnProperty.call(propertyValues, name) ? propertyValues[name] : null;
          },
          getProperties: function() { return Object.assign({}, propertyValues); },
          setProperty: function(name, value) { propertyValues[name] = String(value); },
          deleteProperty: function(name) { delete propertyValues[name]; }
        };
      }
    },
    LockService: {
      getScriptLock: function() {
        return {
          tryLock: function() { return true; },
          releaseLock: function() {}
        };
      }
    },
    ScriptApp: {
      getScriptId: function() { return settings.scriptId || 'test-script-id'; },
      getProjectTriggers: function() { return triggers.slice(); },
      deleteTrigger: function(trigger) {
        const index = triggers.indexOf(trigger);
        if (index !== -1) {
          deletedTriggerHandlers.push(trigger.getHandlerFunction());
          triggers.splice(index, 1);
        }
      },
      newTrigger: function(handlerFunction) {
        const spec = { handlerFunction };
        return {
          timeBased: function() { spec.triggerSource = 'CLOCK'; spec.eventType = 'CLOCK'; return this; },
          inTimezone: function(value) { spec.timezone = value; return this; },
          everyDays: function(value) { spec.everyDays = value; return this; },
          atHour: function(value) { spec.atHour = value; return this; },
           nearMinute: function(value) { spec.nearMinute = value; return this; },
           create: function() {
             if (settings.triggerCreateError) {
               throw new Error(settings.triggerCreateError);
             }
             createdTriggerSpecs.push(Object.assign({}, spec));
            const trigger = makeMockTrigger(spec);
            triggers.push(trigger);
            return trigger;
          }
        };
      }
    },
    UrlFetchApp: {
      fetch: typeof settings.urlFetch === 'function'
        ? settings.urlFetch
        : function() { throw new Error('network disabled in tests'); }
    },
    GmailApp: { search: function() { return []; } }
  };

  vm.createContext(sandbox);
  vm.runInContext(
    code + `
      globalThis.__exports__ = {
        normalizeOpenAlexTitle_: typeof normalizeOpenAlexTitle_ === 'function' ? normalizeOpenAlexTitle_ : undefined,
        computeTitleSimilarity_: typeof computeTitleSimilarity_ === 'function' ? computeTitleSimilarity_ : undefined,
        isHighQualitySource_: typeof isHighQualitySource_ === 'function' ? isHighQualitySource_ : undefined,
        applyVenueQualityScores_: typeof applyVenueQualityScores_ === 'function' ? applyVenueQualityScores_ : undefined,
        selectBestPaperForDirection_: typeof selectBestPaperForDirection_ === 'function' ? selectBestPaperForDirection_ : undefined,
        extractDoi_: typeof extractDoi_ === 'function' ? extractDoi_ : undefined,
        selectBestOpenAlexWorkMatch_: typeof selectBestOpenAlexWorkMatch_ === 'function' ? selectBestOpenAlexWorkMatch_ : undefined,
        extractSourceFromOpenAlexWork_: typeof extractSourceFromOpenAlexWork_ === 'function' ? extractSourceFromOpenAlexWork_ : undefined,
        buildFeishuMessage_: typeof buildFeishuMessage_ === 'function' ? buildFeishuMessage_ : undefined,
        getFiveYearDateRange_: typeof getFiveYearDateRange_ === 'function' ? getFiveYearDateRange_ : undefined,
        reconstructAbstract_: typeof reconstructAbstract_ === 'function' ? reconstructAbstract_ : undefined,
        normalizeOpenAlexWorkToPaper_: typeof normalizeOpenAlexWorkToPaper_ === 'function' ? normalizeOpenAlexWorkToPaper_ : undefined,
        computeCitationScores_: typeof computeCitationScores_ === 'function' ? computeCitationScores_ : undefined,
        enrichActiveSearchSourceMetrics_: typeof enrichActiveSearchSourceMetrics_ === 'function' ? enrichActiveSearchSourceMetrics_ : undefined,
        isAcademicWorkType_: typeof isAcademicWorkType_ === 'function' ? isAcademicWorkType_ : undefined,
        getOpenAlexCachePropertyNamesToDelete_: typeof getOpenAlexCachePropertyNamesToDelete_ === 'function' ? getOpenAlexCachePropertyNamesToDelete_ : undefined,
        computeFreshnessScore_: typeof computeFreshnessScore_ === 'function' ? computeFreshnessScore_ : undefined,
        makePaperKey_: typeof makePaperKey_ === 'function' ? makePaperKey_ : undefined,
        buildOpenAlexWorksQuery_: typeof buildOpenAlexWorksQuery_ === 'function' ? buildOpenAlexWorksQuery_ : undefined,
        buildOpenAlexWorksQueries_: typeof buildOpenAlexWorksQueries_ === 'function' ? buildOpenAlexWorksQueries_ : undefined,
        dedupeOpenAlexWorks_: typeof dedupeOpenAlexWorks_ === 'function' ? dedupeOpenAlexWorks_ : undefined,
        getOpenAlexRetryAfterMs_: typeof getOpenAlexRetryAfterMs_ === 'function' ? getOpenAlexRetryAfterMs_ : undefined,
        getConfiguredDirections_: typeof getConfiguredDirections_ === 'function' ? getConfiguredDirections_ : undefined,
        parseConfiguredDirections_: typeof parseConfiguredDirections_ === 'function' ? parseConfiguredDirections_ : undefined,
        validateLiteratureRadarConfig: typeof validateLiteratureRadarConfig === 'function' ? validateLiteratureRadarConfig : undefined,
        sanitizeErrorForLog_: typeof sanitizeErrorForLog_ === 'function' ? sanitizeErrorForLog_ : undefined,
        logSafeError_: typeof logSafeError_ === 'function' ? logSafeError_ : undefined,
        fetchOpenAlexJson_: typeof fetchOpenAlexJson_ === 'function' ? fetchOpenAlexJson_ : undefined,
        postFeishuText_: typeof postFeishuText_ === 'function' ? postFeishuText_ : undefined,
        setupEveryTwoDaysTrigger: typeof setupEveryTwoDaysTrigger === 'function' ? setupEveryTwoDaysTrigger : undefined,
        listLiteratureRadarTriggers: typeof listLiteratureRadarTriggers === 'function' ? listLiteratureRadarTriggers : undefined,
        removeEveryTwoDaysTrigger: typeof removeEveryTwoDaysTrigger === 'function' ? removeEveryTwoDaysTrigger : undefined,
        PROP_LITERATURE_DIRECTIONS_JSON_: typeof PROP_LITERATURE_DIRECTIONS_JSON !== 'undefined' ? PROP_LITERATURE_DIRECTIONS_JSON : undefined,
        CONFIG_: typeof CONFIG !== 'undefined' ? CONFIG : undefined
      };
    `,
    sandbox
  );
  sandbox.__exports__.__state = {
    properties: propertyValues,
    logs,
    triggers,
    createdTriggerSpecs,
    deletedTriggerHandlers
  };
  return sandbox.__exports__;
}

function makeMockTrigger(spec) {
  const values = Object.assign({
    handlerFunction: '',
    eventType: 'CLOCK',
    triggerSource: 'CLOCK'
  }, spec || {});
  return {
    getHandlerFunction: function() { return values.handlerFunction; },
    getEventType: function() { return values.eventType; },
    getTriggerSource: function() { return values.triggerSource; }
  };
}

function test(name, fn) {
  try {
    fn();
    console.log('PASS ' + name);
  } catch (err) {
    console.error('FAIL ' + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

const api = loadCode();

test('normalizes OpenAlex titles for robust matching', function() {
  assert.strictEqual(
    api.normalizeOpenAlexTitle_('The Annals of Statistics: survival-analysis!'),
    'the annals of statistics survival analysis'
  );
});

test('computes useful title similarity', function() {
  assert.ok(
    api.computeTitleSimilarity_(
      'Clinical trial design in oncology',
      'clinical trial design oncology'
    ) > 0.75
  );
  assert.ok(
    api.computeTitleSimilarity_(
      'Clinical trial design in oncology',
      'large language models for radiology'
    ) < 0.65
  );
});

test('matches high quality source whitelist with aliases', function() {
  assert.strictEqual(api.isHighQualitySource_('JASA', 'statistics'), true);
  assert.strictEqual(api.isHighQualitySource_('Annals of Statistics', 'statistics'), true);
  assert.strictEqual(api.isHighQualitySource_('Lancet Digital Health', 'medical_ml'), true);
  assert.strictEqual(api.isHighQualitySource_('Unknown Venue', 'medical_ml'), false);
});

test('configures the first direction as survival analysis with requested OpenAlex search terms', function() {
  const direction = api.CONFIG_.DIRECTIONS[0];

  assert.strictEqual(direction.label, '生存分析领域');
  assert.strictEqual(direction.activeSearchLabel, 'Survival Analysis');
  assert.strictEqual(JSON.stringify(direction.activeSearchKeywords), JSON.stringify([
    'survival analysis',
    'time-to-event',
    'Cox',
    'competing risks',
    'Kaplan-Meier',
    'restricted mean survival time',
    'multi-state model',
    'censored data',
    'RMTL'
  ]));
});

test('selects survival-analysis candidates with broad screening terms', function() {
  const direction = api.CONFIG_.DIRECTIONS[0];
  const papers = [
    {
      title: 'Restricted mean time lost with censored data in oncology studies',
      authors: 'A Author',
      source: 'Lifetime Data Analysis',
      link: 'https://example.org/rmtl-censored-data',
      snippet: 'RMTL estimands under censoring for event time outcomes.',
      emailDate: new Date('2026-07-04T00:00:00Z')
    }
  ];

  const selected = api.selectBestPaperForDirection_(papers, direction, [], {});

  assert.ok(selected);
  assert.strictEqual(selected.title, papers[0].title);
  assert.ok(selected.matchedKeywords.indexOf('RMTL') !== -1);
});

test('enriches source metrics only for related active-search candidates and dedupes source requests', function() {
  const direction = api.CONFIG_.DIRECTIONS[0];
  const papers = [
    {
      title: 'RMTL estimation with censored data',
      snippet: '',
      source: 'Lifetime Data Analysis',
      cited_by_count: 8,
      openalex: {
        source_id: 'https://openalex.org/S1',
        source_display_name: 'Lifetime Data Analysis',
        m2yr: null,
        h_index: null,
        i10_index: null
      }
    },
    {
      title: 'Competing risks regression in oncology',
      snippet: '',
      source: 'Lifetime Data Analysis',
      cited_by_count: 5,
      openalex: {
        source_id: 'https://openalex.org/S1',
        source_display_name: 'Lifetime Data Analysis',
        m2yr: null,
        h_index: null,
        i10_index: null
      }
    },
    {
      title: 'Protein structure prediction benchmark',
      snippet: '',
      source: 'Unrelated Journal',
      cited_by_count: 50,
      openalex: {
        source_id: 'https://openalex.org/S2',
        source_display_name: 'Unrelated Journal',
        m2yr: null,
        h_index: null,
        i10_index: null
      }
    }
  ];
  const requestedSourceIds = [];

  const enriched = api.enrichActiveSearchSourceMetrics_(papers, direction, 'test-key', function(sourceId) {
    requestedSourceIds.push(sourceId);
    return {
      source_id: 'S1',
      source_display_name: 'Lifetime Data Analysis',
      m2yr: 4.2,
      h_index: 72,
      i10_index: 210,
      cited_by_count: 12000,
      works_count: 1500,
      source_type: 'journal',
      issn_l: '1380-7870'
    };
  });

  assert.strictEqual(JSON.stringify(requestedSourceIds), JSON.stringify(['S1']));
  assert.strictEqual(enriched[0].openalex.m2yr, 4.2);
  assert.strictEqual(enriched[1].openalex.h_index, 72);
  assert.strictEqual(enriched[2].openalex.m2yr, null);
});

test('keeps active-search candidates when source metric enrichment fails', function() {
  const paper = {
    title: 'Cox regression for time-to-event outcomes',
    snippet: '',
    source: 'Example Journal',
    openalex: {
      source_id: 'https://openalex.org/S9',
      source_display_name: 'Example Journal',
      m2yr: null,
      h_index: null,
      i10_index: null
    }
  };

  const enriched = api.enrichActiveSearchSourceMetrics_(
    [paper],
    api.CONFIG_.DIRECTIONS[0],
    'test-key',
    function() { throw new Error('temporary OpenAlex failure'); }
  );

  assert.strictEqual(enriched.length, 1);
  assert.ok(enriched[0].openalex.error_note.includes('fallback'));
});

test('rejects datasets from the active-search paper pool', function() {
  assert.strictEqual(api.isAcademicWorkType_('article'), true);
  assert.strictEqual(api.isAcademicWorkType_('preprint'), true);
  assert.strictEqual(api.isAcademicWorkType_('dataset'), false);
});

test('prunes expired invalid and excess OpenAlex cache properties', function() {
  const now = new Date('2026-07-10T00:00:00Z');
  const properties = {
    OPENALEX_WORK_CACHE_V1_expired: JSON.stringify({ fetched_at: '2026-05-01T00:00:00Z' }),
    OPENALEX_SOURCE_CACHE_V1_invalid: '{bad json',
    OPENALEX_SOURCE_CACHE_V1_old: JSON.stringify({ fetched_at: '2026-07-01T00:00:00Z' }),
    OPENALEX_SOURCE_CACHE_V1_new: JSON.stringify({ fetched_at: '2026-07-09T00:00:00Z' }),
    FEISHU_WEBHOOK: 'keep'
  };

  const keys = api.getOpenAlexCachePropertyNamesToDelete_(properties, now, 1).sort();

  assert.strictEqual(JSON.stringify(keys), JSON.stringify([
    'OPENALEX_SOURCE_CACHE_V1_invalid',
    'OPENALEX_SOURCE_CACHE_V1_old',
    'OPENALEX_WORK_CACHE_V1_expired'
  ]));
});

test('computes venue quality scores and marks OA-Q1 proxy within a direction', function() {
  const direction = { id: 'statistics', label: '统计学方向' };
  const papers = [
    makePaper('Top paper', 'Statistics in Medicine', 10, 200, 400),
    makePaper('Middle paper', 'Clinical Trials', 5, 80, 100),
    makePaper('Low paper', 'Unknown Journal', 1, 5, 10),
    makePaper('Lower paper', 'Small Journal', 0.2, 3, 4),
    makePaper('Lowest paper', 'Tiny Journal', null, null, null)
  ];

  const scored = api.applyVenueQualityScores_(papers, direction);

  assert.ok(scored[0].venue_quality_score > scored[2].venue_quality_score);
  assert.strictEqual(scored[0].OA_Q1_PROXY, true);
  assert.strictEqual(scored[4].OA_Q1_PROXY, false);
});

test('selects OA-Q1 proxy first and falls back to final score', function() {
  const direction = {
    id: 'statistics',
    label: '统计学方向',
    keywords: ['survival analysis', 'clinical trial design']
  };
  const pushedKeys = [];
  const reservedKeys = {};
  const today = new Date('2026-07-04T00:00:00Z');
  const papers = [
    Object.assign(makePaper('Related but lower venue survival analysis', 'Unknown Journal', 0.2, 2, 2), {
      title: 'Related but lower venue survival analysis',
      snippet: 'survival analysis clinical trial design',
      emailDate: today,
      OA_Q1_PROXY: false,
      venue_quality_score: 0.2,
      whitelist_bonus: 0
    }),
    Object.assign(makePaper('Moderately related high venue survival model', 'Statistics in Medicine', 9, 200, 300), {
      title: 'Moderately related high venue survival model',
      snippet: 'survival analysis',
      emailDate: today,
      OA_Q1_PROXY: true,
      venue_quality_score: 0.9,
      whitelist_bonus: 1
    })
  ];

  const selected = api.selectBestPaperForDirection_(papers, direction, pushedKeys, reservedKeys);

  assert.strictEqual(selected.title, 'Moderately related high venue survival model');
  assert.strictEqual(selected.OA_Q1_PROXY, true);
  assert.ok(selected.final_score > 0);
  assert.ok(selected.whyRecommended.includes('OA-Q1 proxy'));
  assert.ok(selected.whyRecommended.includes('最终综合分'));
});

test('falls back to original relatedness ordering when OpenAlex is unavailable', function() {
  const direction = {
    id: 'statistics',
    label: '统计学方向',
    keywords: ['survival analysis', 'clinical trial design']
  };
  const papers = [
    {
      title: 'Older highly related survival analysis clinical trial design',
      authors: 'A Author',
      source: 'Unknown',
      link: 'https://example.org/older',
      snippet: 'survival analysis clinical trial design',
      emailDate: new Date('2026-07-01T00:00:00Z')
    },
    {
      title: 'Newer weakly related survival analysis',
      authors: 'B Author',
      source: 'Statistics in Medicine',
      link: 'https://example.org/newer',
      snippet: 'survival analysis',
      emailDate: new Date('2026-07-04T00:00:00Z')
    }
  ];

  const selected = api.selectBestPaperForDirection_(papers, direction, [], {});

  assert.strictEqual(selected.title, 'Older highly related survival analysis clinical trial design');
});

test('extracts DOI and rejects unreliable OpenAlex title matches', function() {
  const paper = {
    title: 'Clinical trial design in oncology',
    link: 'https://doi.org/10.1000/example.2026',
    snippet: ''
  };
  const badResults = [
    { id: 'https://openalex.org/W1', title: 'Large language models for radiology' }
  ];
  const goodResults = [
    { id: 'https://openalex.org/W2', title: 'Clinical Trial Design in Oncology' }
  ];

  assert.strictEqual(api.extractDoi_(paper), '10.1000/example.2026');
  assert.strictEqual(api.selectBestOpenAlexWorkMatch_(paper, badResults), null);
  assert.strictEqual(api.selectBestOpenAlexWorkMatch_(paper, goodResults).id, 'https://openalex.org/W2');
});

test('extracts OpenAlex source metrics safely', function() {
  const source = api.extractSourceFromOpenAlexWork_({
    primary_location: {
      source: {
        id: 'https://openalex.org/S123',
        display_name: 'Statistics in Medicine',
        type: 'journal',
        issn_l: '0277-6715',
        cited_by_count: 12345,
        works_count: 6789,
        summary_stats: {
          '2yr_mean_citedness': 4.2,
          h_index: 190,
          i10_index: 500
        }
      }
    }
  });

  assert.strictEqual(source.source_id, 'https://openalex.org/S123');
  assert.strictEqual(source.source_display_name, 'Statistics in Medicine');
  assert.strictEqual(source.m2yr, 4.2);
  assert.strictEqual(source.h_index, 190);
  assert.strictEqual(source.i10_index, 500);
});

test('builds Feishu message with OpenAlex quality fields and proxy note', function() {
  const message = api.buildFeishuMessage_([
    {
      direction: { label: '统计学方向' },
      paper: {
        title: 'A survival analysis paper',
        authors: 'A Author',
        source: 'Statistics in Medicine',
        publicationDate: '2026-07-04',
        link: 'https://example.org/paper',
        relatedness_score_norm: 0.82,
        venue_quality_score: 0.91,
        OA_Q1_PROXY: true,
        whyRecommended: 'Strong survival analysis match.',
        openalex: {
          source_display_name: 'Statistics in Medicine',
          m2yr: 8.5,
          h_index: 180,
          i10_index: 450
        }
      }
    }
  ], 1);

  assert.ok(message.includes('Direction: 统计学方向'));
  assert.ok(message.includes('Venue Quality Score: 0.91'));
  assert.ok(message.includes('OA-Q1 Proxy: Yes'));
  assert.ok(message.includes('OA-Q1 proxy is based on OpenAlex metrics and is not official JCR quartile.'));
});

test('computes dynamic five-year date range', function() {
  const range = api.getFiveYearDateRange_(new Date('2026-07-04T12:00:00Z'));

  assert.strictEqual(range.fromDate, '2021-07-04');
  assert.strictEqual(range.toDate, '2026-07-04');
});

test('reconstructs OpenAlex abstract inverted index', function() {
  const abstractText = api.reconstructAbstract_({
    clinical: [0],
    trial: [1],
    design: [2],
    survival: [3],
    analysis: [4]
  });

  assert.strictEqual(abstractText, 'clinical trial design survival analysis');
});

test('normalizes OpenAlex work to existing paper shape', function() {
  const paper = api.normalizeOpenAlexWorkToPaper_(mockOpenAlexWork());

  assert.strictEqual(paper.title, 'Clinical trial design for survival analysis');
  assert.strictEqual(paper.authors, 'Alice A; Bob B');
  assert.strictEqual(paper.publicationDate, '2025-02-03');
  assert.strictEqual(paper.doi, '10.1000/active.2025');
  assert.strictEqual(paper.openalex.openalex_work_id, 'https://openalex.org/W123');
  assert.strictEqual(paper.openalex.source_display_name, 'Statistics in Medicine');
  assert.ok(paper.snippet.includes('clinical trial design'));
});

test('computes citation and active-search freshness scores inside a direction', function() {
  const papers = [
    { openalex: { cited_by_count: 100 }, cited_by_count: 100 },
    { openalex: { cited_by_count: 10 }, cited_by_count: 10 },
    { openalex: { cited_by_count: null }, cited_by_count: null }
  ];

  api.computeCitationScores_(papers);

  assert.strictEqual(papers[0].citation_score, 1);
  assert.ok(papers[1].citation_score > papers[2].citation_score);
  assert.strictEqual(papers[2].citation_score, 0);
  assert.strictEqual(api.computeFreshnessScore_('2026-07-04', '2021-07-04', '2026-07-04'), 1);
  assert.strictEqual(api.computeFreshnessScore_('2021-07-04', '2021-07-04', '2026-07-04'), 0);
  assert.ok(api.computeFreshnessScore_(null, '2021-07-04', '2026-07-04', 2024) > 0);
});

test('uses DOI then OpenAlex work ID then title for dedupe key', function() {
  const doiKey = api.makePaperKey_({ doi: '10.1000/ABC', title: 'Same', openalex: { openalex_work_id: 'W1' } });
  const doiKeySame = api.makePaperKey_({ doi: 'https://doi.org/10.1000/abc', title: 'Different', openalex: { openalex_work_id: 'W2' } });
  const workKey = api.makePaperKey_({ title: 'Same', openalex: { openalex_work_id: 'https://openalex.org/W123' } });
  const titleKey = api.makePaperKey_({ title: 'Same', openalex: {} });

  assert.strictEqual(doiKey, doiKeySame);
  assert.notStrictEqual(doiKey, workKey);
  assert.notStrictEqual(workKey, titleKey);
});

test('builds OpenAlex works query with direction keywords and date range', function() {
  const query = api.buildOpenAlexWorksQuery_(
    {
      id: 'statistics',
      activeSearchLabel: 'Statistics / Survival Analysis / Clinical Trial Design',
      activeSearchKeywords: ['survival analysis', 'clinical trial design']
    },
    { fromDate: '2021-07-04', toDate: '2026-07-04' }
  );

  assert.strictEqual(query.search, 'survival analysis OR clinical trial design');
  assert.ok(!query.filter.includes('.search:'));
  assert.ok(query.filter.includes('from_publication_date:2021-07-04'));
  assert.ok(query.filter.includes('to_publication_date:2026-07-04'));
  assert.ok(query.filter.includes('language:en'));
  assert.ok(query.filter.includes('is_retracted:false'));
  assert.ok(query.select.includes('abstract_inverted_index'));
  assert.ok(query.select.includes('primary_location'));
  assert.ok(query.select.includes('relevance_score'));
  assert.strictEqual(query.per_page, 75);
  assert.strictEqual(query.sort, 'relevance_score:desc,cited_by_count:desc');
});

test('splits broad OpenAlex searches and preserves the per-direction result budget', function() {
  const queries = api.buildOpenAlexWorksQueries_(
    api.CONFIG_.DIRECTIONS[1],
    { fromDate: '2021-07-04', toDate: '2026-07-04' }
  );

  assert.strictEqual(queries.length, 2);
  assert.strictEqual(queries.reduce(function(total, query) {
    return total + query.per_page;
  }, 0), 75);
  queries.forEach(function(query) {
    assert.ok(query.search);
    assert.ok(query.search.split(' OR ').length <= 6);
    assert.ok(!query.filter.includes('.search:'));
    assert.strictEqual(query.sort, 'relevance_score:desc,cited_by_count:desc');
  });
});

test('dedupes chunked OpenAlex works and keeps the most relevant results first', function() {
  const works = api.dedupeOpenAlexWorks_([
    { id: 'https://openalex.org/W1', relevance_score: 8, cited_by_count: 2 },
    { id: 'https://openalex.org/W1', relevance_score: 9, cited_by_count: 1 },
    { id: 'https://openalex.org/W2', relevance_score: 3, cited_by_count: 99 },
    { id: 'https://openalex.org/W3', relevance_score: 8, cited_by_count: 4 }
  ], 75);

  assert.strictEqual(works.length, 3);
  assert.strictEqual(works[0].id, 'https://openalex.org/W1');
  assert.strictEqual(works[0].relevance_score, 9);
  assert.strictEqual(works[1].id, 'https://openalex.org/W3');
  assert.strictEqual(works[2].id, 'https://openalex.org/W2');
});

test('parses OpenAlex retryAfter seconds for one bounded retry', function() {
  assert.strictEqual(api.getOpenAlexRetryAfterMs_('{"retryAfter":1}'), 1200);
  assert.strictEqual(api.getOpenAlexRetryAfterMs_('not json'), 1200);
});

test('uses default directions only when custom configuration is absent or blank', function() {
  const missingApi = loadCode();
  const blankApi = loadCode({ properties: { LITERATURE_DIRECTIONS_JSON: '   ' } });

  assert.strictEqual(
    JSON.stringify(missingApi.getConfiguredDirections_()),
    JSON.stringify(missingApi.CONFIG_.DIRECTIONS)
  );
  assert.strictEqual(
    JSON.stringify(blankApi.getConfiguredDirections_()),
    JSON.stringify(blankApi.CONFIG_.DIRECTIONS)
  );
});

test('loads custom directions and reuses scoring keywords for active search', function() {
  const custom = [
    {
      id: 'causal_inference',
      label: '因果推断',
      keywords: ['causal inference', 'target trial', 'Causal Inference']
    }
  ];
  const customApi = loadCode({
    properties: { LITERATURE_DIRECTIONS_JSON: JSON.stringify(custom) }
  });
  const directions = customApi.getConfiguredDirections_();

  assert.strictEqual(directions.length, 1);
  assert.strictEqual(directions[0].id, 'causal_inference');
  assert.strictEqual(JSON.stringify(directions[0].keywords), JSON.stringify(['causal inference', 'target trial']));
  assert.strictEqual(JSON.stringify(directions[0].activeSearchKeywords), JSON.stringify(['causal inference', 'target trial']));

  const query = customApi.buildOpenAlexWorksQuery_(directions[0], {
    fromDate: '2021-01-01',
    toDate: '2026-01-01'
  });
  assert.strictEqual(query.search, 'causal inference OR target trial');

  const selected = customApi.selectBestPaperForDirection_([
    makePaper('A target trial emulation study', 'Example Journal', 1, 2, 3)
  ], directions[0], [], {});
  assert(selected);
  assert(selected.matchedKeywords.includes('target trial'));
});

test('keeps active search and scoring keyword roles separate when both are configured', function() {
  const customApi = loadCode({
    properties: {
      LITERATURE_DIRECTIONS_JSON: JSON.stringify([{
        id: 'precision_medicine',
        label: '精准医学',
        activeSearchKeywords: ['precision medicine study'],
        keywords: ['genomic biomarker']
      }])
    }
  });
  const direction = customApi.getConfiguredDirections_()[0];
  const query = customApi.buildOpenAlexWorksQuery_(direction, {
    fromDate: '2021-01-01',
    toDate: '2026-01-01'
  });

  assert.strictEqual(query.search, 'precision medicine study');
  assert(!query.search.includes('genomic biomarker'));
  const selected = customApi.selectBestPaperForDirection_([
    makePaper('A genomic biomarker validation study', 'Example Journal', 1, 2, 3)
  ], direction, [], {});
  assert(selected);
  assert(selected.matchedKeywords.includes('genomic biomarker'));
});

test('loads up to five independent custom directions', function() {
  const custom = Array.from({ length: 5 }, function(_value, index) {
    return {
      id: 'topic_' + (index + 1),
      label: 'Topic ' + (index + 1),
      activeSearchKeywords: ['topic search ' + (index + 1)],
      keywords: ['topic score ' + (index + 1)]
    };
  });
  const customApi = loadCode({
    properties: { LITERATURE_DIRECTIONS_JSON: JSON.stringify(custom) }
  });

  assert.strictEqual(customApi.getConfiguredDirections_().length, 5);
});

test('accepts documented direction field length boundaries', function() {
  const activeSearchKeywords = ['s'.repeat(100)].concat(
    Array.from({ length: 11 }, function(_value, index) { return 'search ' + index; })
  );
  const keywords = ['k'.repeat(100)].concat(
    Array.from({ length: 49 }, function(_value, index) { return 'score ' + index; })
  );
  const customApi = loadCode({
    properties: {
      LITERATURE_DIRECTIONS_JSON: JSON.stringify([{
        id: 'a'.repeat(32),
        label: 'L'.repeat(60),
        activeSearchKeywords: activeSearchKeywords,
        keywords: keywords
      }])
    }
  });
  const direction = customApi.getConfiguredDirections_()[0];

  assert.strictEqual(direction.id.length, 32);
  assert.strictEqual(direction.label.length, 60);
  assert.strictEqual(direction.activeSearchKeywords.length, 12);
  assert.strictEqual(direction.keywords.length, 50);
  assert.strictEqual(direction.activeSearchKeywords[0].length, 100);
  assert.strictEqual(direction.keywords[0].length, 100);
});

test('accepts prototype-like ids and keywords without collection collisions', function() {
  const customApi = loadCode({
    properties: {
      LITERATURE_DIRECTIONS_JSON: JSON.stringify([{
        id: 'constructor',
        label: 'Constructor Topic',
        keywords: ['constructor']
      }])
    }
  });
  const direction = customApi.getConfiguredDirections_()[0];

  assert.strictEqual(direction.id, 'constructor');
  assert.strictEqual(JSON.stringify(direction.keywords), JSON.stringify(['constructor']));
  const selected = customApi.selectBestPaperForDirection_([
    makePaper('Constructor methods in clinical research', 'Example Journal', 1, 2, 3)
  ], direction, [], {});
  assert(selected);
});

test('rejects invalid custom direction configuration without fallback', function() {
  const valid = {
    id: 'topic',
    label: 'Topic',
    activeSearchKeywords: ['topic search'],
    keywords: ['topic score']
  };
  const invalidValues = [
    '{bad json',
    JSON.stringify({ topic: valid }),
    JSON.stringify([]),
    JSON.stringify(Array.from({ length: 6 }, function(_value, index) {
      return Object.assign({}, valid, { id: 'topic_' + index });
    })),
    JSON.stringify([valid, Object.assign({}, valid)]),
    JSON.stringify([Object.assign({}, valid, { id: 123 })]),
    JSON.stringify([Object.assign({}, valid, { id: 'Bad ID' })]),
    JSON.stringify([Object.assign({}, valid, { id: 'a'.repeat(33) })]),
    JSON.stringify([Object.assign({}, valid, { label: 123 })]),
    JSON.stringify([Object.assign({}, valid, { label: '' })]),
    JSON.stringify([Object.assign({}, valid, { label: 'L'.repeat(61) })]),
    JSON.stringify([Object.assign({}, valid, { keywords: [] })]),
    JSON.stringify([Object.assign({}, valid, { keywords: [123] })]),
    JSON.stringify([Object.assign({}, valid, { keywords: ['k'.repeat(101)] })]),
    JSON.stringify([Object.assign({}, valid, { activeSearchKeywords: ['heart failure, preserved ejection fraction'] })]),
    JSON.stringify([Object.assign({}, valid, { activeSearchKeywords: ['line one\nline two'] })]),
    JSON.stringify([Object.assign({}, valid, {
      activeSearchKeywords: Array.from({ length: 13 }, function(_value, index) { return 'keyword ' + index; })
    })]),
    JSON.stringify([Object.assign({}, valid, {
      keywords: Array.from({ length: 51 }, function(_value, index) { return 'keyword ' + index; })
    })])
  ];

  invalidValues.forEach(function(value) {
    const invalidApi = loadCode({ properties: { LITERATURE_DIRECTIONS_JSON: value } });
    assert.throws(function() {
      invalidApi.getConfiguredDirections_();
    }, /LITERATURE_DIRECTIONS_JSON/);
  });
});

test('prints a credential-free configuration summary', function() {
  const customApi = loadCode({
    properties: {
      LITERATURE_DIRECTIONS_JSON: JSON.stringify([{
        id: 'evidence_synthesis',
        label: '证据综合',
        keywords: ['systematic review']
      }]),
      OPENALEX_API_KEY: 'private-openalex-value',
      FEISHU_WEBHOOK: 'https://example.test/private-webhook-value'
    }
  });
  const summary = customApi.validateLiteratureRadarConfig();
  const logged = customApi.__state.logs.join('\n');

  assert.strictEqual(summary.directionCount, 1);
  assert.strictEqual(summary.openAlexApiKeyConfigured, true);
  assert.strictEqual(summary.feishuWebhookConfigured, true);
  assert(!logged.includes('private-openalex-value'));
  assert(!logged.includes('private-webhook-value'));
});

test('redacts configured credentials and credential-bearing URLs from error logs', function() {
  const webhook = ['https://open.feishu.cn', 'open-apis/bot/v2/hook', 'raw-webhook-token'].join('/');
  const secureApi = loadCode({
    properties: {
      OPENALEX_API_KEY: 'raw-api-secret',
      FEISHU_WEBHOOK: webhook,
      FEISHU_SIGN_SECRET: 'raw-sign-secret'
    }
  });
  secureApi.logSafeError_('request failed: ', new Error(
    'GET https://api.openalex.org/works?api_key=raw-api-secret&per-page=1 ' +
    'POST ' + webhook + ' raw-sign-secret'
  ));
  const logged = secureApi.__state.logs.join('\n');

  assert(logged.includes('[REDACTED]'));
  assert(!logged.includes('raw-api-secret'));
  assert(!logged.includes('raw-webhook-token'));
  assert(!logged.includes('raw-sign-secret'));
});

test('redacts credentials from network exceptions before they escape', function() {
  const apiKey = 'boundary-api-secret';
  const webhook = ['https://open.feishu.cn', 'open-apis/bot/v2/hook', 'boundary-webhook-token'].join('/');
  const secureApi = loadCode({
    properties: {
      OPENALEX_API_KEY: apiKey,
      FEISHU_WEBHOOK: webhook
    },
    urlFetch: function(url) {
      throw new Error('network failure for ' + url);
    }
  });

  [
    function() {
      secureApi.fetchOpenAlexJson_('https://api.openalex.org/works?api_key=' + apiKey);
    },
    function() {
      secureApi.postFeishuText_('test');
    }
  ].forEach(function(operation) {
    assert.throws(operation, function(err) {
      const message = String(err);
      return !message.includes(apiKey) && !message.includes('boundary-webhook-token');
    });
  });
});

test('validates custom directions before replacing the production trigger', function() {
  const triggerApi = loadCode({
    properties: { LITERATURE_DIRECTIONS_JSON: '{bad json' },
    triggers: [
      { handlerFunction: 'runEveryTwoDaysOpenAlexPush' },
      { handlerFunction: 'anotherHandler' }
    ]
  });

  assert.throws(function() {
    triggerApi.setupEveryTwoDaysTrigger();
  }, /LITERATURE_DIRECTIONS_JSON/);
  assert.strictEqual(triggerApi.__state.deletedTriggerHandlers.length, 0);
  assert.strictEqual(triggerApi.__state.createdTriggerSpecs.length, 0);
  assert.strictEqual(triggerApi.__state.triggers.length, 2);
});

test('lists replaces and removes only the production Literature Radar trigger', function() {
  const triggerApi = loadCode({
    properties: {
      OPENALEX_API_KEY: 'test-openalex-key',
      FEISHU_WEBHOOK: 'https://example.test/webhook'
    },
    triggers: [
      { handlerFunction: 'runEveryTwoDaysOpenAlexPush' },
      { handlerFunction: 'anotherHandler' }
    ]
  });

  triggerApi.setupEveryTwoDaysTrigger();
  const listed = triggerApi.listLiteratureRadarTriggers();
  assert.strictEqual(listed.length, 2);
  assert.strictEqual(listed.filter(function(trigger) { return trigger.isLiteratureRadar; }).length, 1);
  assert.deepStrictEqual(triggerApi.__state.createdTriggerSpecs[0], {
    handlerFunction: 'runEveryTwoDaysOpenAlexPush',
    triggerSource: 'CLOCK',
    eventType: 'CLOCK',
    timezone: 'Asia/Shanghai',
    everyDays: 2,
    atHour: 7,
    nearMinute: 30
  });

  assert.strictEqual(triggerApi.removeEveryTwoDaysTrigger(), 1);
  assert.strictEqual(triggerApi.__state.triggers.length, 1);
  assert.strictEqual(triggerApi.__state.triggers[0].getHandlerFunction(), 'anotherHandler');
});

test('keeps the previous production trigger when replacement creation fails', function() {
  const triggerApi = loadCode({
    properties: {
      OPENALEX_API_KEY: 'test-openalex-key',
      FEISHU_WEBHOOK: 'https://example.test/webhook'
    },
    triggers: [
      { handlerFunction: 'runEveryTwoDaysOpenAlexPush' },
      { handlerFunction: 'anotherHandler' }
    ],
    triggerCreateError: 'trigger quota exceeded'
  });

  assert.throws(function() {
    triggerApi.setupEveryTwoDaysTrigger();
  }, /trigger quota exceeded/);
  assert.strictEqual(triggerApi.__state.deletedTriggerHandlers.length, 0);
  assert.strictEqual(triggerApi.__state.createdTriggerSpecs.length, 0);
  assert.strictEqual(triggerApi.__state.triggers.length, 2);
  assert.strictEqual(triggerApi.__state.triggers[0].getHandlerFunction(), 'runEveryTwoDaysOpenAlexPush');
});

test('does not create a production trigger when required credentials are missing', function() {
  const triggerApi = loadCode({
    triggers: [{ handlerFunction: 'runEveryTwoDaysOpenAlexPush' }]
  });

  assert.throws(function() {
    triggerApi.setupEveryTwoDaysTrigger();
  }, /OpenAlex API Key/);
  assert.strictEqual(triggerApi.__state.deletedTriggerHandlers.length, 0);
  assert.strictEqual(triggerApi.__state.createdTriggerSpecs.length, 0);
  assert.strictEqual(triggerApi.__state.triggers.length, 1);
});

test('rejects blank credentials and invalid Webhooks without replacing triggers', function() {
  [
    { OPENALEX_API_KEY: '   ', FEISHU_WEBHOOK: 'https://example.test/webhook' },
    { OPENALEX_API_KEY: 'test-openalex-key', FEISHU_WEBHOOK: '   ' },
    { OPENALEX_API_KEY: 'test-openalex-key', FEISHU_WEBHOOK: 'not-a-webhook-url' }
  ].forEach(function(properties) {
    const triggerApi = loadCode({
      properties: properties,
      triggers: [{ handlerFunction: 'runEveryTwoDaysOpenAlexPush' }]
    });

    assert.throws(function() {
      triggerApi.setupEveryTwoDaysTrigger();
    }, /OpenAlex API Key|Webhook/);
    assert.strictEqual(triggerApi.__state.deletedTriggerHandlers.length, 0);
    assert.strictEqual(triggerApi.__state.createdTriggerSpecs.length, 0);
    assert.strictEqual(triggerApi.__state.triggers.length, 1);
  });
});

function mockOpenAlexWork() {
  return {
    id: 'https://openalex.org/W123',
    title: 'Clinical trial design for survival analysis',
    doi: 'https://doi.org/10.1000/active.2025',
    publication_date: '2025-02-03',
    publication_year: 2025,
    type: 'article',
    language: 'en',
    cited_by_count: 42,
    primary_location: {
      landing_page_url: 'https://example.org/paper',
      source: {
        id: 'https://openalex.org/S123',
        display_name: 'Statistics in Medicine',
        type: 'journal',
        issn_l: '0277-6715',
        cited_by_count: 10000,
        works_count: 5000,
        summary_stats: {
          '2yr_mean_citedness': 6.5,
          h_index: 210,
          i10_index: 800
        }
      }
    },
    authorships: [
      { author: { display_name: 'Alice A' } },
      { author: { display_name: 'Bob B' } }
    ],
    abstract_inverted_index: {
      clinical: [0],
      trial: [1],
      design: [2],
      for: [3],
      survival: [4],
      analysis: [5]
    }
  };
}

function makePaper(title, source, m2yr, hIndex, i10Index) {
  return {
    title,
    authors: 'A Author',
    source,
    link: 'https://example.org/' + encodeURIComponent(title),
    snippet: title,
    emailDate: new Date('2026-07-04T00:00:00Z'),
    openalex: {
      source_display_name: source,
      m2yr,
      h_index: hIndex,
      i10_index: i10Index,
      cited_by_count: 100,
      works_count: 1000,
      source_type: 'journal'
    }
  };
}
