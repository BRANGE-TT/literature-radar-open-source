# Repository Guidelines

## Project Structure & Module Organization

`Code.gs` contains OpenAlex retrieval, scoring, Feishu delivery, triggers, and test helpers. `appsscript.json` defines the V8 runtime and OAuth scopes. Tests live in `tests/openalex_quality.test.js`; configuration samples live in `examples/`, design notes in `docs/`, and CI in `.github/workflows/`. Keep generated output and dependencies out of Git.

## Build, Test, and Development Commands

- `node tests/openalex_quality.test.js` runs the offline regression suite. Network access is deliberately disabled in its sandbox.
- `Get-Content -Raw -Encoding UTF8 Code.gs | node --check -` checks JavaScript syntax without executing Apps Script APIs.
- `node -e "JSON.parse(require('fs').readFileSync('appsscript.json','utf8')); console.log('manifest ok')"` validates the manifest.
- `npx @google/clasp push` syncs only `Code.gs` and `appsscript.json` to your separate Apps Script project.

There is no local server or build bundle. In Apps Script, run `testEveryTwoDaysDryRun()` before any live Feishu push or trigger change.

## Coding Style & Naming Conventions

Use Apps Script-compatible JavaScript with two-space indentation, single quotes, semicolons, and `const` unless reassignment is required. Follow existing names: `UPPER_SNAKE_CASE` for constants, `camelCase` for public entry points, and a trailing underscore for internal helpers, such as `buildFeishuMessage_()`. Keep changes surgical within `Code.gs`; do not add dependency tooling for one-off logic.

## Testing Guidelines

Add focused cases to `tests/openalex_quality.test.js` using its `test('behavior', function() { ... })` helper and Node's `assert`. If testing a new internal function, expose it through the sandbox's `__exports__` object. Cover success, fallback, filtering, and deduplication behavior affected by the change. No numeric coverage threshold is configured; every bug fix should include a reproducing test.

## Security & Configuration

Store `OPENALEX_API_KEY`, `FEISHU_WEBHOOK`, and optional `FEISHU_SIGN_SECRET` in Apps Script Properties, never in tracked files. Do not commit `.clasp.json`, environment files, credentials, tokens, or live trigger details. Gmail support is optional and requires restoring its OAuth scope before use.

## Commit & Pull Request Guidelines

Use the repository's short, imperative Conventional Commit style: `fix: preserve public Scholar Alert sender`, `test: validate isolated Apps Script integrations`, or `docs: clarify proxy scoring`. Pull requests should explain the behavior change, list commands run, note manifest or property requirements, and link the relevant issue when one exists. Include dry-run log excerpts for changes to selection or message output; screenshots are only useful for visible Apps Script or Feishu behavior.
