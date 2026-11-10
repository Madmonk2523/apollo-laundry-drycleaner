# Verification record

10 November 2026.

## Passed

- `node --check app.js`
- `node --test tests/*.test.js`: 22 tests.
- `git diff --check`
- HTML nesting and duplicate-ID checks.
- Independent static review of responsive CSS and existing request code.
- Simulated DOM interactions with jsdom: pickup success, delivery success without an order reference, validation/focus, Back, close/reopen reset, Escape, menu dismissal, live contact summary, and unavailable-email-service error with retry enabled.

The DOM harness uses mocked network responses and test data. It does not send requests to Apollo or the email provider. It is not a real-browser layout test.

To run it with an isolated development dependency:

```sh
npm install --prefix /tmp/apollo-qa --cache /tmp/apollo-npm-cache --no-audit --no-fund jsdom
NODE_PATH=/tmp/apollo-qa/node_modules node qa/dom-check.cjs
```

## Not completed

- Desktop browser review of the public production site completed November 10, 2026. Confirmed new review section and corrected an existing FAQ grid overflow. Mobile layout was statically reviewed but has not been visually tested at a mobile viewport. No protection settings were changed or wider-access preview links created.
- Real email deliverability: requires the production email configuration and a separately authorized live test.
- Google identity and review quotations verified November 10, 2026. Photo republication remains pending rights: see CONTENT-SOURCES.md.

The initial refresh was promoted to production after explicit approval. Do not describe on-page photography as finished.
