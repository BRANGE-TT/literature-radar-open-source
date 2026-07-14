# Validation History

This file records only reusable, non-secret validation evidence. It intentionally omits local paths, Script IDs, Webhooks, API keys, OAuth data, and personal project details.

## 2026-07-14 Isolated Development Validation

- A separate Apps Script project was used for the open-source checkout.
- Apps Script syntax, manifest parsing, offline regression tests, OpenAlex retrieval, scoring, and a dry run passed.
- A manually initiated full flow selected one paper for each of the two then-default directions and delivered the formatted Feishu message successfully.
- The scheduled handler was also invoked manually as an equivalent execution-path check; delivery and isolated test deduplication passed.
- One time-driven development trigger was created and listed successfully during validation.
- A future platform-initiated `CLOCK` event was not observed in that session and must not be reported as verified.

These checks are historical evidence, not a substitute for the fresh-install and release checks in [`RELEASE_CHECKLIST.md`](../../RELEASE_CHECKLIST.md).
