const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCode() {
  const codePath = path.join(__dirname, '..', 'Code.gs');
  const code = fs.readFileSync(codePath, 'utf8');
  const sandbox = {
    console,
    Logger: { log: function() {} },
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
          getProperty: function() { return ''; },
          setProperty: function() {},
          deleteProperty: function() {}
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
      getProjectTriggers: function() { return []; },
      deleteTrigger: function() {},
      newTrigger: function() {
        return {
          timeBased: function() { return this; },
          inTimezone: function() { return this; },
          everyDays: function() { return this; },
          atHour: function() { return this; },
          nearMinute: function() { return this; },
          create: function() { return this; }
        };
      }
    },
    UrlFetchApp: { fetch: function() { throw new Error('network disabled in tests'); } },
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
        CONFIG_: typeof CONFIG !== 'undefined' ? CONFIG : undefined
      };
    `,
    sandbox
  );
  return sandbox.__exports__;
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

  assert.strictEqual(typeof query.search, 'undefined');
  assert.ok(query.filter.includes('title_and_abstract.search:survival analysis OR clinical trial design'));
  assert.ok(query.filter.includes('from_publication_date:2021-07-04'));
  assert.ok(query.filter.includes('to_publication_date:2026-07-04'));
  assert.ok(query.filter.includes('language:en'));
  assert.ok(query.filter.includes('is_retracted:false'));
  assert.ok(query.select.includes('abstract_inverted_index'));
  assert.ok(query.select.includes('primary_location'));
  assert.strictEqual(query.per_page, 75);
  assert.strictEqual(query.sort, 'cited_by_count:desc');
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
    const searchFilter = query.filter.split(',').filter(function(value) {
      return value.indexOf('title_and_abstract.search:') === 0;
    })[0];
    assert.ok(searchFilter);
    assert.ok(searchFilter.replace('title_and_abstract.search:', '').split(' OR ').length <= 6);
    assert.strictEqual(query.sort, 'cited_by_count:desc');
  });
});

test('dedupes chunked OpenAlex works and keeps the most cited results first', function() {
  const works = api.dedupeOpenAlexWorks_([
    { id: 'https://openalex.org/W1', cited_by_count: 2 },
    { id: 'https://openalex.org/W1', cited_by_count: 2 },
    { id: 'https://openalex.org/W2', cited_by_count: 9 }
  ], 75);

  assert.strictEqual(works.length, 2);
  assert.strictEqual(works[0].id, 'https://openalex.org/W2');
});

test('parses OpenAlex retryAfter seconds for one bounded retry', function() {
  assert.strictEqual(api.getOpenAlexRetryAfterMs_('{"retryAfter":1}'), 1200);
  assert.strictEqual(api.getOpenAlexRetryAfterMs_('not json'), 1200);
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
