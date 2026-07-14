# Security Policy

## Supported Version

Security fixes are applied to the latest commit on `main`. Until the first tagged release, the project should be treated as beta software.

## Reporting a Vulnerability

Use GitHub's private vulnerability reporting feature when it is available. Include the affected function, reproduction steps, expected impact, and a minimal proof of concept.

Do not put credentials, private Webhook URLs, API keys, OAuth tokens, Script IDs, personal data, or unredacted execution logs in a public issue. If private reporting is unavailable, open a public issue containing only a short description and request a private contact channel.

## Script Property Handling

Keep credentials in Apps Script Properties:

- `OPENALEX_API_KEY`
- `FEISHU_WEBHOOK`
- `FEISHU_SIGN_SECRET`

`LITERATURE_DIRECTIONS_JSON` is configuration rather than a credential, but storing it in Script Properties keeps each installation independent from the repository defaults.

Never commit `.clasp.json`, `.clasprc.json`, `.env` files, OAuth credentials, tokens, or exported Apps Script properties. If a credential is exposed, revoke or rotate it before removing it from the repository.
