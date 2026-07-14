# Public Release Checklist

Use this checklist before changing the GitHub repository from Private to Public.

## Required

- [x] Research directions can be configured without editing `Code.gs`.
- [x] Invalid explicit configuration fails before sending or replacing a trigger.
- [x] Default directions remain backward compatible.
- [x] Offline tests, Apps Script syntax, manifest, and example JSON pass.
- [x] `.clasp.json`, `.clasprc.json`, credentials, tokens, and logs are ignored.
- [ ] GitHub Actions passes on the public-ready commit.
- [x] README includes a fresh-install path and user configuration schema.
- [x] Security and contribution policies are present.
- [x] GitHub description and topics identify the project.
- [ ] GitHub private vulnerability reporting is enabled.
- [ ] Repository owner selects and adds an open-source license.
- [ ] Fresh installation is verified in a new Apps Script project owned by a test account.
- [ ] Repository history privacy is reviewed; old validation commits contain non-secret local environment metadata.
- [x] A final current-tree and reachable-history credential scan passes.
- [ ] Repository owner explicitly approves changing visibility to Public.

## Beta Follow-up

- [ ] Observe a real time-driven `CLOCK` execution after installation. Equivalent manual handler execution has passed, but a future clock event must not be reported as already observed.
- [ ] Add a redacted Feishu example screenshot.
- [ ] Tag `v0.1.0` only after the fresh-install check succeeds.

Do not rewrite Git history, force-push, create a release, or change repository visibility as part of routine development validation.
