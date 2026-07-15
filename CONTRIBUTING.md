# Contributing

Thank you for improving Literature Radar. Keep changes focused on the Google Apps Script workflow and avoid adding credentials or generated artifacts.

## Development Setup

Use Node.js 20 or newer. The project has no runtime npm dependencies.

```sh
node tests/openalex_quality.test.js
node --check < Code.gs
node -e "const fs=require('fs'); ['appsscript.json','examples/directions.example.json','examples/config-v2.example.json'].forEach(f=>JSON.parse(fs.readFileSync(f,'utf8'))); console.log('json ok')"
```

In PowerShell, use `Get-Content -Raw -Encoding UTF8 Code.gs | node --check -` for the syntax check.

Tests run offline in a mocked Apps Script environment. Do not make them depend on live OpenAlex, Google, or Feishu services.

## Change Guidelines

- Use two-space indentation, single quotes, and semicolons in `Code.gs`.
- Keep public entry points in `camelCase`; suffix internal helpers with `_`.
- Preserve the default directions when adding configuration features.
- Keep `LITERATURE_RADAR_CONFIG_JSON` versioned and preserve the documented legacy-property fallback.
- Treat invalid explicit configuration as an error instead of silently selecting another topic.
- Do not change scoring weights or OA-Q1 proxy behavior without focused tests and a documented rationale.
- Add or update tests for every behavior change.

## Pull Requests

Use a short Conventional Commit-style title, such as `feat: support custom research directions`. Describe the user-visible change, Script Property additions, tests run, and any authorization or manifest impact. Include redacted dry-run output for selection changes; never include live Webhooks, API keys, tokens, Script IDs, or personal data.
