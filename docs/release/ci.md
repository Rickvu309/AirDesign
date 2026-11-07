# CI and production delivery

Every pull request runs the same gate as `npm run gate`. Pushes to `main` run the full gate. Railway waits for CI and emits a deployment status after deploying. Pushes to `ci-landing` also run CI so this initial workflow can be verified before a pull request exists. Remove `ci-landing` from the push branch list after this branch lands.

## Run locally

Use Node 24, PostgreSQL, Chromium and LibreOffice. Install Chromium with `npx playwright install chromium`. Set `AIRDESIGN_PG_HOST` and `AIRDESIGN_PG_USER` for a PostgreSQL administrator that can create and drop test databases. The local defaults use the existing development socket and user. Set `AIRDESIGN_SOFFICE` to the LibreOffice executable for the real PowerPoint conversion check; the existing adapter otherwise reports unavailable.

Run `heavy --label ci-gate -- npm run gate` on the shared development machine. The runner installs dependencies, builds once, checks lint and types, runs both unit shards, then every PR verification group. It stops at the first failure. It creates temporary test files under `~/tmp/airdesign-gate` and uses the Playwright Chromium binary for the pinned `agent-browser` CLI.

Individual steps use `npm run gate:install`, `npm run gate:build`, `npm run gate:lint`, `npm run gate:typecheck`, `npm run gate:unit -- 1/2`, `npm run gate:unit -- 2/2`, and `npm run gate:verify -- <group>`. Run install and build before a standalone verification group. `npm run gate:setup` combines install and build.

## Job graph

`setup → {static lint, static typecheck, unit 1/2, unit 2/2, verification groups} → gate`

Setup restores the npm download cache, installs once, and builds the site, Studio, worker renderer, MCP renderer, deck package and UI package. The exact build is cached by commit and lockfile. One tar artifact preserves executable permissions, workspace symlinks and dependencies nested inside workspaces for all downstream jobs. It expires after two days. Regression lint tests use committed original-source excerpts with revision provenance, so a fresh checkout needs no local Git objects. Chromium has its own lockfile-keyed cache. Each browser job installs only system libraries. There are no independent workspace installs or repeated application builds in verification scripts. The package-consumer test deliberately builds and installs a clean package to verify its published contract.

| Verification group | PR scripts | Mean baseline seconds | Runtime inputs |
| --- | --- | ---: | --- |
| `render-brand` | 02, 06 | 82.70 | Chromium, isolated worker |
| `pptx-agent` | 03, 08 | 61.78 | PostgreSQL, LibreOffice, isolated worker |
| `sync` | 04 | 79.70 | PostgreSQL, Chromium |
| `studio-mcp` | 05, 07 | 106.37 | PostgreSQL, Chromium, isolated worker |
| `release` | 01, 09 | 89.28 | PostgreSQL, Chromium, package registry |

These baseline sums guide grouping. They exclude CI runtime setup and the new LibreOffice conversion. Both unit shards need PostgreSQL, Chromium and isolated workers.

The shared plan is `scripts/gate/plan.ts`. CI derives its verification matrix from that plan, and local execution reads the same plan. Vitest discovers `test` and `spec` files across every workspace, including TypeScript, JSX and JavaScript module extensions, across two shards. `scripts/gate/unit-sharding.ts` greedily balances the recorded baseline durations in `scripts/gate/unit-durations.json`; unknown files receive a one-second estimate and are always included. Refresh the estimates from a passing Vitest results cache after material suite changes. The baseline hash split estimated 200.0 versus 129.0 seconds of test work; the measured split estimates 164.5 seconds each before worker startup overhead. The lint policy rejects omitted PR verifiers, filtered workspace discovery, incomplete shards and unpinned actions; mutation tests demonstrate those failures.

Only changes exclusively to this informational guide can skip heavy work on pull requests or the temporary `ci-landing` branch. Design and planning documentation is test input and always runs the full gate. Pushes to `main` always build. `gate` runs even when other jobs fail or are skipped and rejects unexpected skips. Require the check named `gate` in the main branch ruleset after the coordinator lands the workflow. No branch rules are configured by this change.

The project npm configuration permits the required native installer scripts for `agent-browser`, esbuild, workerd and the Railway CLI. This makes installation independent of a developer's global npm configuration. The gate clears npm's inherited installer-policy environment flag before starting child npm commands, so npm reads the project configuration directly. A subprocess regression test proves that the original inherited flag fails and the corrected environment preserves other inputs.

CI has read-only repository access. Every external action is pinned to a full commit SHA. New commits cancel superseded runs for their branch or pull request. Fork pull requests have no deployment access.

Worker tests exercise both systemd/Bubblewrap and container drivers. Unit shards and the render-brand, pptx-agent and studio-mcp groups prepare the real user systemd session and Bubblewrap, copy the selected Node 24 binary to the worker’s fixed `/usr/bin/node` path, and permit unprivileged namespaces on the disposable runner. A smoke command proves the driver starts before tests run. Both isolated worker entry points now mount optional `/lib64`, which x64 ELF loaders require and the original ARM-only mount list omitted. Local hosts need the equivalent worker runtime.

## Deployment

`deploy.yml` runs only on `deployment_status`. The revision job accepts successful events from `railway-app[bot]` for `airdesign / production`. It checks the event SHA against current `main` before publishing. Every checkout, the site build identity, and the live-check expectation use `github.event.deployment.sha`.

Only CI runs on push. The post-deploy workflow creates no push or workflow-run check suite for Railway to wait on. A newer successful production event cancels the older production run. Other status events have separate concurrency groups and cannot cancel production verification.

The site job builds `apps/site` with `AIRDESIGN_BUILD_SHA` set to the verified commit, then publishes Cloudflare Pages project `airdesign`. Railway independently deploys `web` and `worker` from GitHub. `.railway/railway.ts` enables `checkSuites: true`; the coordinator must apply that configuration after merge. Keep Railway's GitHub integration enabled. No workflow calls `railway up`.

A success event can come from either Railway service. The live job installs Chromium, LibreOffice Impress, and Railway CLI 5.71.0. It links to the production project, waits at most 20 minutes for Studio `/version` to report the expected commit, then runs the existing `verify:live` journey with `--expect-sha`, `--smoke-email smoke@airdesign.app`, and `--railway`. Worker identity is checked by the verifier's real import journey. A failed wait or journey fails the workflow. Receipt, screenshots, and export evidence upload even when the journey fails. There is no verification skip or automatic rollback.

Configure these secrets in GitHub's `production` environment before a main deployment:

| Secret | Scope |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages Edit for the account owning existing project `airdesign` |
| `CLOUDFLARE_ACCOUNT_ID` | Account owning Pages project `airdesign` |
| `RAILWAY_API_TOKEN` | Account or workspace API token with access to the production project and its registered SSH key |
| `RAILWAY_SSH_PRIVATE_KEY` | Dedicated, unencrypted Ed25519 private key whose public key the coordinator registers with that Railway account or workspace |

Set production environment variable `RAILWAY_PROJECT_ID` to the existing project's UUID. It is not a secret. Railway's project token `RAILWAY_TOKEN` cannot manage SSH keys; use `RAILWAY_API_TOKEN` for the key lookup and service resolution. The CLI uses native system SSH, so a token alone is insufficient. The API token is present only in the Railway link and live-verification steps. The SSH private-key secret is present only in the key-installation and link step. Cloudflare credentials are present only in the Pages publish step. Dependency installation receives no deployment secrets. The workflow installs the key with owner-only permissions, derives its public key, and deletes both key files in its final cleanup step. It never prints the one-use smoke sign-in credential. See [Railway CLI tokens](https://docs.railway.com/cli) and [Railway SSH authentication](https://docs.railway.com/cli/ssh).

No secrets, branch rules, live configuration, or deployments were changed during implementation. Production delivery remains unproved until the coordinator sets these inputs, applies the Railway configuration after merge, and observes a successful main workflow.

## Enable the pending checks

The `design` job in `.github/workflows/ci.yml` is explicitly disabled with `if: ${{ false }}`. In the PR that lands `verify:design`, replace that expression with `needs.setup.outputs.heavy == 'true'`. It already restores the shared build and Chromium. Add any further runtime inputs required by the design script. The final gate already depends on this job and rejects failures.

## Measurements

The table records two passing serial trials on the unchanged base commit. Local and hosted runners use different machines, so their wall times describe observed turnaround rather than a controlled speedup. The first local attempt failed because the shared `/tmp` quota was exceeded; the two measured trials use a dedicated `~/tmp` directory.

| Original step | Trial 1 (s) | Trial 2 (s) | PostgreSQL | LibreOffice | Chromium | External network |
| --- | ---: | ---: | --- | --- | --- | --- |
| `npm ci` | 8.56 | 8.10 | — | — | — | npm registry |
| `npm run build` | 2.67 | 2.93 | — | — | — | — |
| `npm test` | 191.36 | 194.09 | Yes | — | Yes | Clean package consumer |
| `npm run typecheck` | 12.72 | 13.29 | — | — | — | — |
| `npm run lint` | 2.28 | 3.00 | — | — | — | — |
| `npm run verify:pr-01` | 50.16 | 48.64 | — | — | Yes | Clean package consumer |
| `npm run verify:pr-02` | 44.96 | 47.43 | — | — | Yes | — |
| `npm run verify:pr-03` | 37.59 | 44.32 | — | Optional* | — | — |
| `npm run verify:pr-04` | 75.01 | 84.39 | Yes | — | Yes | — |
| `npm run verify:pr-05` | 64.69 | 78.76 | Yes | — | Yes | — |
| `npm run verify:pr-06` | 31.80 | 41.20 | — | — | — | — |
| `npm run verify:pr-07` | 30.54 | 38.74 | Yes | — | Yes | — |
| `npm run verify:pr-08` | 19.07 | 22.58 | Yes | — | — | — |
| `npm run verify:pr-09` | 35.23 | 44.53 | Yes | — | — | — |
| **Serial total** | **606.63** | **672.01** | | | | |

*LibreOffice was unavailable in both local baselines. CI installs it and checks a real PDF conversion. All 28 measured commands exited 0. Network here means external access beyond loopback PostgreSQL, local servers and browser fixtures.

The mean serial turnaround was 639.32 seconds; range 606.63–672.01 seconds across two warm-cache local trials. This is an observed baseline on shared Linux arm64 hardware, not a cross-machine speedup claim.
