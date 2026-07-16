# Validation History

This file records only reusable, non-secret validation evidence. It intentionally omits local paths, Script IDs, Webhooks, API keys, OAuth data, and personal project details.

## 2026-07-16 Fresh-Install Validation

- Created a new standalone Apps Script project and copied only the current `Code.gs` and `appsscript.json`; both editor models matched the repository files after line-ending normalization.
- Installed the checked-in config v2 example plus test credentials through Script Properties. `validateLiteratureRadarConfig()` reported schema v2, two directions, and boolean-only credential status.
- The original medical-AI example Topic produced no candidates. A current OpenAlex Topic lookup identified `T11636` (`Artificial Intelligence in Healthcare and Education`); after updating the example, dry run returned 74 causal-inference and 73 medical-AI candidates and selected relevant papers in both directions.
- No Feishu message was sent, no pushed-paper history was written, and `listLiteratureRadarTriggers()` returned an empty list.
- After validation, all 44 temporary Script Properties and caches were deleted, temporary helper functions were removed, and both editor files were rechecked against the repository.

## 2026-07-16 Reachable-History Privacy Review

- Reviewed all reachable commits for local paths, Script identifiers, credential patterns, and sensitive files.
- Three early commits contain non-secret local directory names, two truncated Script IDs, and one SHA-256 fingerprint of a development Script ID. No complete Script ID, Webhook, API key, OAuth token, or tracked credential file was found.
- The remaining metadata is accepted as low risk. Git history will not be rewritten or force-pushed for these items.

## 2026-07-15 Config v2 Live Validation

- Synced the config v2 implementation to the isolated Apps Script development project and verified the editor content matched the local `Code.gs`.
- A one-time wrapper temporarily installed a non-secret v2 configuration with one causal-inference direction, English language, a four-year lookback, and an exclusion phrase.
- `validateLiteratureRadarConfig()` reported `schemaVersion: 2` and `configSource: v2`; `testEveryTwoDaysDryRun()` parsed 73 candidates and selected a relevant target-trial framework paper.
- A `finally` block restored the original property, reported the restoration as successful, and a subsequent validation confirmed the original default two-direction configuration.
- The wrapper was removed and the remote editor was checked against the local file again. No Feishu message was sent, no formal pushed-paper history was written, and no trigger was created or changed.

## 2026-07-15 Top-Level Search Live Validation

- Synced the current `Code.gs` to the isolated Apps Script development project and verified the reloaded editor content matched the local file after line-ending normalization.
- `validateLiteratureRadarConfig()` completed with two directions and boolean-only credential status; no credential value or Script ID was logged.
- The first top-level `search` run exposed irrelevant full-text matches when results were citation-first. The query and chunk merge were changed to prefer `relevance_score`, with citation count used only as a tie-breaker.
- After the fix, `testEveryTwoDaysDryRun()` completed without an execution error: survival analysis returned 73 candidates and medical machine learning returned 61. The selected papers were relevant to Cox survival-model evaluation and generalist medical AI.
- The dry run did not send Feishu messages or write formal pushed-paper history. It could update OpenAlex caches and execution logs.
- This validates an equivalent manual handler execution only; a real time-driven `CLOCK` event has still not been observed.

## 2026-07-14 Isolated Development Validation

- A separate Apps Script project was used for the open-source checkout.
- Apps Script syntax, manifest parsing, offline regression tests, OpenAlex retrieval, scoring, and a dry run passed.
- A manually initiated full flow selected one paper for each of the two then-default directions and delivered the formatted Feishu message successfully.
- The scheduled handler was also invoked manually as an equivalent execution-path check; delivery and isolated test deduplication passed.
- One time-driven development trigger was created and listed successfully during validation.
- A future platform-initiated `CLOCK` event was not observed in that session and must not be reported as verified.

These checks are historical evidence, not a substitute for the fresh-install and release checks in [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md).
