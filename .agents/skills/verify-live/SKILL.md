---
name: verify-live
description: Verify the deployed AirDesign commit and the complete smoke-account browser journey after every web, worker, or site deploy.
---

Run after every deployment, including rollbacks. This performs real account writes and exports. Use only a dedicated, empty smoke account whose normalized email is listed in the web service's `AIRDESIGN_SMOKE_EMAILS`. Never use a customer or operator's normal account. Never weaken, skip, or relabel a failing check to obtain a pass.

Use the checkout of the expected deployed commit. Install dependencies and Chromium locally. Keep the fixture at `fixtures/pptx/preservation.pptx` and the LibreOffice checker available. Override its path with `AIRDESIGN_LIBREOFFICE` and the Chrome executable with `AIRDESIGN_CHROME_PATH` when necessary.

```sh
npm ci
npx playwright install chromium
npm run verify:live -- --expect-sha "$(git rev-parse HEAD)" --smoke-email "$AIRDESIGN_SMOKE_EMAIL" --railway
```

The operator must already be authenticated to Railway and linked to the intended project and environment. The runner invokes this exact command at the sign-in step, capturing stdout directly in memory:

```sh
railway ssh --service web -- node apps/server/src/smoke/mint-link.ts "$AIRDESIGN_SMOKE_EMAIL"
```

Do not run the mint command by itself, paste its output into chat, save it, or enable shell tracing. The random link expires after two minutes and can be consumed only once. There is no public mint endpoint. Only the existing access flow sets the normal session cookie. The allowlist defaults to empty; a container operator is the trust boundary. C09's ordinary emailed-link lifetime remains unchanged. This operator credential is shorter lived and uses the same atomic consume and expiry checks.

Defaults are `https://airdesign.app`, `https://studio.airdesign.app`, and `https://mcp.airdesign.app`. To target a local or staging stack, supply all three origins:

```sh
npm run verify:live -- --expect-sha "$EXPECTED_SHA" --site-url "$SITE_ORIGIN" --studio-url "$STUDIO_ORIGIN" --mcp-url "$MCP_ORIGIN" --smoke-email "$AIRDESIGN_SMOKE_EMAIL" --railway --output-dir "$HOME/tmp/airdesign-live-verify/release"
```

A custom operator can pipe a link to stdin instead of `--railway`; mint it only when the runner reaches sign-in. Prefer `--railway` so the two-minute lifetime starts after the public-page checks. Never pass a link as a command-line argument.

The first line of stderr names the failed step. Exit zero requires `status: "pass"` in `receipt.json`, matching site, Studio, and completed-import worker SHAs, and every named step passing. Receipts include the import workerSha, timestamps, checked links, screenshot paths, and allowedBrowserExceptions, never the sign-in URL or cookies. Evidence defaults to `~/tmp/airdesign-live-verify/<sha>-<timestamp>/`. Keep it with the release record. Review screenshots and both exports; a failed journey is a release failure. Fix the cause or roll back, then rerun the complete check.

The journey blocks paid Aira requests, checks its entry point, creates a blank deck, imports the preservation fixture, saves and reloads a title, exports PPTX and PDF, opens the PPTX with LibreOffice, then moves both decks to Trash and empties it. It refuses a nonempty account before creating anything. On an interrupted run, inspect and clean only that dedicated account before retrying.

For a production-free rehearsal with deliberate wrong-SHA, broken-link, stale-worker, and Studio script-error failures:

```sh
npm run build
npm run verify:live:local
```

The rehearsal uses the isolated PostgreSQL/browser fixture and removes its database and temporary worker storage. It never deploys or accesses production.
