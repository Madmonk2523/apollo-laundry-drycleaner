# Apollo review checks

This branch was cut from the GitHub main commit deployed to Apollo’s existing production project (`b6224e6`). It does not change production. Tests use public building points and synthetic contact data, and never send an actual email.

## Quick local run

```sh
node scripts/build-static.js
node --test tests/*.test.js
node qa/preview-server.cjs
```

Open **http://127.0.0.1:4173** to review on your computer. The local preview resolves real addresses from the included city directory, but Send request only returns **PREVIEW-ONLY**. It will not contact the shop or save what you enter. The site itself loads its existing map and fonts; this local server makes no outbound requests.

Try **137 Franklin St, Brooklyn** for inside and **10 E 95th St, Manhattan** for outside. Keyboard: enter an address, use Up/Down then Enter to choose, and Check address to move to request details. Escape dismisses suggestions first, then the dialog.

## Repeat the automated UI smoke test

```sh
npm install --prefix /tmp/apollo-qa --no-audit --no-fund jsdom
NODE_PATH=/tmp/apollo-qa/node_modules node qa/dom-check.cjs
```

Passed with the actual local address handler and mocked request response: keyboard and pointer selection, apartment paste, outside vs unresolved and service failure, stale network replies, edit/back/reopen, submission and retry, menu and reviews. The API tests separately mock Resend to check address enforcement, the recipient payload and failure behavior.

`qa/browser-check.cjs` is a Playwright script for touch/keyboard and overflow at 375, 390, 768 and 1440 pixels. It blocks all external resources. Run it with Playwright on your Node module path and `CHROMIUM_PATH` pointing to Chromium. The cloud executor blocked Chromium from creating its local UNIX-domain socket, so real browser layout and screenshots have **not** been verified in this run. No live Resend test, Vercel build, push or deployment was performed.
