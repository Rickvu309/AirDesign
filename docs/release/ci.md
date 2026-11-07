# CI and production delivery

Every pull request runs the same gate as `npm run gate`. Pushes to `main` run the full gate. GitHub Actions deploys production only after main push CI succeeds. Pushes to `ci-landing` also run CI so this initial workflow can be verified before a pull request exists. Remove `ci-landing` from the push branch list after this branch lands.

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

These baseline sums guide grouping. They exclude CI runtime setup and the new LibreOffice conversion. Both unit shards need PostgreSQL, Chromium and isolated workers. Their verbose logs name each passing test file so critical PostgreSQL coverage can be checked directly.

The shared plan is `scripts/gate/plan.ts`. CI derives its verification matrix from that plan, and local execution reads the same plan. Vitest discovers `test` and `spec` files across every workspace, including TypeScript, JSX and JavaScript module extensions, across two shards. `scripts/gate/unit-sharding.ts` greedily balances the recorded baseline durations in `scripts/gate/unit-durations.json`; unknown files receive a one-second estimate and are always included. Refresh the estimates from a passing Vitest results cache after material suite changes. The baseline hash split estimated 200.0 versus 129.0 seconds of test work; the measured split estimates 164.5 seconds each before worker startup overhead. The lint policy rejects omitted PR verifiers, filtered workspace discovery, incomplete shards and unpinned actions; mutation tests demonstrate those failures.

Only changes exclusively to this informational guide can skip heavy work on pull requests or the temporary `ci-landing` branch. Design and planning documentation is test input and always runs the full gate. Pushes to `main` always build. `gate` runs even when other jobs fail or are skipped and rejects unexpected skips. Require the check named `gate` in the main branch ruleset after the coordinator lands the workflow. No branch rules are configured by this change.

The project npm configuration permits the required native installer scripts for `agent-browser`, esbuild, workerd and the Railway CLI. This makes installation independent of a developer's global npm configuration. The gate clears npm's inherited installer-policy environment flag before starting child npm commands, so npm reads the project configuration directly. A subprocess regression test proves that the original inherited flag fails and the corrected environment preserves other inputs.

CI has read-only repository access. Every external action is pinned to a full commit SHA. New commits cancel superseded runs for their branch or pull request. Fork pull requests have no deployment access.

Worker tests exercise both systemd/Bubblewrap and container drivers. Unit shards and the render-brand, pptx-agent and studio-mcp groups prepare the real user systemd session and Bubblewrap, copy the selected Node 24 binary to the worker’s fixed `/usr/bin/node` path, and permit unprivileged namespaces on the disposable runner. A smoke command proves the driver starts before tests run. Both isolated worker entry points now mount optional `/lib64`, which x64 ELF loaders require and the original ARM-only mount list omitted. Local hosts need the equivalent worker runtime.

## Deployment

`.github/workflows/deploy.yml` is the only production deploy controller. It accepts completed CI runs for main pushes from this repository with conclusion success. The single `production` concurrency group uses `cancel-in-progress: false`: a running deployment finishes verification before another starts. GitHub keeps one pending run and replaces older pending runs. Queue order is not guaranteed, so the controller checks current main immediately before its first Railway request and records stale runs without deploying.

The workflow uses the existing GitHub environment `airdesign / production`. It preserves that environment's protection rules and secrets instead of creating an unrelated environment named `production`. All dependency, browser, CLI and LibreOffice installation finishes before any secret is exposed. Wrangler 4.158.0 and Railway CLI 5.71.0 are installed under `~/tmp/release-tools`; publication executes the local Wrangler binary without a package fetch.

`scripts/release/railway-production.ts` requests worker then web using `railway deployment redeploy --project <project> --environment production --service <worker|web> --commit <sha> --yes`. Both requests build from the connected GitHub source at the approved CI SHA. CLI 5.71.0's `railway deployment redeploy --help` documents `--commit <SHA>` as deploying a specific commit from the connected repository once without pinning it. This keeps `RAILWAY_GIT_COMMIT_SHA` aligned with build identity. See [Railway CLI source at v5.71.0](https://github.com/railwayapp/cli/tree/v5.71.0) and [deployment commands](https://docs.railway.com/cli/deployment).

The controller has a 20-minute deadline and a 60-second limit per CLI call. It requires a new deployment ID for each service, with `meta.commitHash` equal to the selected SHA and status `SUCCESS`. Previous successful deployments cannot satisfy the wait. A failed or crashed deployment fails immediately. Studio `/version` must then report the same SHA. Only after this barrier does the workflow publish Cloudflare Pages project `airdesign` with that SHA and run `verify:live --expect-sha ... --smoke-email smoke@airdesign.app --railway`. The verifier exercises the worker import journey and checks worker identity as well as Studio, MCP and Pages. Verification still runs after a Pages publication failure if the Railway barrier succeeded.

The controller writes `railway-deploy.json` on success, stale selection, timeout or failure. The always-run upload includes this receipt and any live verification evidence. There is no rollback or verification bypass. A failed deployment request or readiness barrier stops publication and the live journey, with failure evidence retained.

### One-time production setup before enabling the controller

In Railway project `airdesign`, environment `production`, open **web → Settings → Source** and click **Disable** for automatic GitHub deployments. Repeat for **worker → Settings → Source**. Keep `Rickvu309/AirDesign` connected to branch `main` for both services. Turn **Wait for CI** off for both services (`source.checkSuites: false`, declared in `.railway/railway.ts`). Do not disconnect the GitHub source. [Railway documents the Disable control and Wait for CI](https://docs.railway.com/deployments/github-autodeploys).

Railway TypeScript SDK 3.16.0's `ServiceSource` and `SourceConfig` declarations expose `repo`, `branch`, `commitSha` and `checkSuites`, but no GitHub automatic-trigger flag. `autoUpdates` applies only to image sources. The automatic-trigger toggle must therefore be set in the dashboard. It is outside the IaC schema, so plan cannot declare, detect or repair drift in that toggle. The connected source and `checkSuites: false` remain declared and should have no source drift after setup; unrelated live drift is not covered by that claim. Confirm the two Disable states separately whenever reviewing a plan. No Railway setting was applied during implementation.

Configure these GitHub secrets in the existing `airdesign / production` environment or retain their existing repository scope:

| Secret | Scope |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Pages Edit for existing project `airdesign` |
| `CLOUDFLARE_ACCOUNT_ID` | Account owning that Pages project |
| `RAILWAY_API_TOKEN` | Account or workspace API token with production deploy and SSH access |
| `RAILWAY_SSH_PRIVATE_KEY` | Unencrypted Ed25519 key registered with that Railway account or workspace |

Set `RAILWAY_PROJECT_ID` to the existing project's UUID. The Railway token is scoped to the deploy controller, SSH link and verifier steps. Cloudflare credentials are scoped to publication. The SSH key appears only in its setup step, is written with owner-only permissions and is deleted by the final cleanup. Install steps receive no secret. See [Railway CLI tokens](https://docs.railway.com/cli) and [SSH authentication](https://docs.railway.com/cli/ssh).

Tests simulate web-first and worker-first completion, failed services, stale runs, old successful deployment IDs, wrong SHAs, timeout and boundary errors. The workflow policy rejects the old native Wait for CI topology, missing guards, cancellation and installer secret exposure. Production delivery remains unproved until the one-time setup is complete and the workflow runs on main. Implementation does not merge, deploy or apply Railway configuration.

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
