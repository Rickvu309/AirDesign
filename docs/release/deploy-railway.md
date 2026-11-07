# Deploy AirDesign on Railway

## Configure the services

Build the root Dockerfile with Node 24. The image builds Studio, the public site, the PDF renderer, and the MCP capture renderer. Its runtime installs production npm dependencies, Playwright Chromium, browser system libraries, util-linux, and Debian tini. Run as the image's unprivileged node user.

`.railway/railway.ts` is the source of truth for both services: GitHub source, build, start command, health check, domains, volumes and non-secret variables. Secrets (`DATABASE_URL`, `AIRDESIGN_SECRET`, `AIRDESIGN_CLAUDE_KEY`, `RESEND_API_KEY`) are marked `preserve()` and live only in Railway. Change service configuration in that file and run `railway config plan`, then `railway config apply`, from a checkout linked to the project. Both services use the same image. Do not scale either service beyond one replica in this release.

## Deploy from GitHub

Both services deploy from `Rickvu309/AirDesign` branch `main` through the Railway GitHub integration. A push to `main` builds `web` and `worker` from that commit. Wait-for-CI (`checkSuites`) is `true` in `.railway/railway.ts`. After merging the CI workflow, the coordinator must run `railway config plan` and `railway config apply` from the linked checkout to activate this setting. Railway waits for the CI checks and skips deployment on failure. The GitHub Deploy workflow publishes Pages and verifies the resulting live commit; it does not deploy Railway services. Railway passes `RAILWAY_GIT_COMMIT_SHA` to the Docker build, so `/version` reports the deployed commit with no manual variable. Do not set `AIRDESIGN_BUILD_SHA` on Railway; it would override the real commit. Use `railway up` only for an emergency deploy of a commit that is already on `main`.

Roll back a bad deploy by redeploying the last good commit on both services: `railway deployment redeploy --service web --commit <good-sha> --yes` and the same with `--service worker`. That deploys the earlier commit once without changing the source. Stop automatic deploys with `railway service source disconnect --service web` and `railway service source disconnect --service worker`; the command acts on one service at a time and defaults to the linked one. Reconnect by running `railway config apply` from a checkout of `main`. Reverting `.railway/railway.ts` does not restore an older configuration by itself, and `railway.json` files are no longer accepted.

| Service | Command | Storage | Health check |
| --- | --- | --- | --- |
| web | `/app/scripts/docker/entrypoint.sh` | Persistent writable volume mounted at `/data` | GET `/healthz`, 200 only after a live database query |
| worker | `/app/scripts/docker/entrypoint.sh` with `AIRDESIGN_ROLE=worker` | Separate persistent volume mounted at `/data` | Process supervision; no public listener |
| Postgres | Railway managed PostgreSQL | Managed persistent database | Railway managed |

Deploy the built `apps/site/dist` separately to Cloudflare Pages project `airdesign`. Set `AIRDESIGN_STUDIO_ORIGIN` at build time to override its default, `https://studio.airdesign.app`.

Route both `studio.airdesign.app` and `mcp.airdesign.app` to `web`. Routing is by path: Studio at `/studio` and editor routes, API at `/api`, sync at `/ws`, MCP at `/mcp`, OAuth at `/oauth`, and discovery at `/.well-known`. Both hosts expose the same service routes. MCP's resource audience uses the MCP origin; its authorization server and browser consent use the Studio origin. TLS terminates at Railway. The server constructs production request origins from the configured HTTPS public origin and never trusts a caller's forwarded header. Session cookies therefore remain secure behind the proxy.

## Set the environment

Values and credentials belong in Railway variables, never in version control.

| Service | Variable names |
| --- | --- |
| web | `NODE_ENV`, `PORT`, `DATABASE_URL`, `AIRDESIGN_SECRET`, `AIRDESIGN_PUBLIC_ORIGIN`, `AIRDESIGN_MCP_ORIGIN`, `RESEND_API_KEY`, `MAIL_FROM`, `AIRDESIGN_CLAUDE_KEY`, `ANTHROPIC_API_KEY`, `AIRDESIGN_CLAUDE_MODEL`, `AIRDESIGN_OPERATIONS_PATH` |
| worker | `NODE_ENV`, `DATABASE_URL`, `AIRDESIGN_SECRET`, `AIRDESIGN_WORKER_API_ORIGIN`, `AIRDESIGN_OPERATIONS_PATH`, `AIRDESIGN_ISOLATION`, `AIRDESIGN_WORKER_TEMP`, `PLAYWRIGHT_BROWSERS_PATH` |

Use `production` for `NODE_ENV`. Set the two public origins to their respective HTTPS origins, without trailing slashes. Use the same secret of at least 32 characters in both services. `DATABASE_URL` is the Railway PostgreSQL reference; `AIRDESIGN_DATABASE_URL` remains an alias for existing installations.

Set the web operation path to `/data/operations.sqlite`. SQLite stores import jobs, image jobs, and template metadata on this web volume. PostgreSQL stores accounts, saved decks, export jobs, usage, OAuth, and deletion records. A shared filesystem between services is unnecessary. The worker claims import and image payloads through the authenticated `/internal/worker` endpoint. Completion is fenced by the originating lease. Use Railway's private web URL for `AIRDESIGN_WORKER_API_ORIGIN`, including its port. The internal endpoint requires the shared secret on every request, including when reached through a public host.

Set the worker operation path to `/data/operations.sqlite` on its own volume. Remote job scratch defaults to `/data/jobs` beside that database; `AIRDESIGN_WORKER_TEMP` overrides it and must stay on the same persistent worker volume. A durable journal records the remote lease, local operation database, scratch directory, systemd unit and container process group before job execution. Restart kills recovered groups and erases their files before acknowledging cleanup to web. Web retains leases and blocks account deletion until that acknowledgment. A missing worker journal fails closed; restore the original worker volume before retrying. Keep one worker writer and retain its volume across releases. Container jobs wait for the journal commit before executing, and kill their group if their supervisor disappears. The image sets `AIRDESIGN_ISOLATION=container` and `PLAYWRIGHT_BROWSERS_PATH`. The web volume must be writable by the node user. Mount only one writer of this volume.

`AIRDESIGN_EXPOSE_INBOX=1` is refused in production. Resend is selected when its key is present; the in-memory inbox remains the development default. `AIRDESIGN_RESEND_ENDPOINT` is an optional HTTP adapter override for a local mail mock during rehearsal. Omit it in Railway. Payments remain unavailable because no payment provider is injected.

Startup applies existing idempotent account and deck schema initialization. Deploy web first, then worker, to avoid concurrent first-time schema creation. Back up the database before upgrades; there is no automatic down migration.

## Understand container isolation

`AIRDESIGN_ISOLATION=systemd` preserves systemd user scopes and bubblewrap network and filesystem namespaces. Use it on hosts that provide those facilities.

In container mode the worker starts beneath a dedicated outer `tini -s -- node apps/worker/src/container-worker-entry.ts` subreaper. The Docker worker entrypoint launches that wrapper directly. A standalone worker entry re-execs into it before accepting work. Initialization checks the parent executable, wrapper arguments and PID start time. The wrapper keeps a guardian process as tini’s direct child and starts the worker below it. The handshake also checks the guardian executable, arguments and PID start time. Service cycles share one worker process and one live-job registry.

An orphan sweep runs at startup, every 100 ms, on every job exit and on orderly worker exit. It preserves the guardian, the worker and registered live job roots with their descendants. It freezes and kills all other descendants of the outer subreaper deepest first, checking each PID start time before signaling. If a payload kills its own tini, its detached children reparent to the outer subreaper and the sweep removes them. An unexpectedly SIGKILLed job tini produces the typed export failure `{kind:"isolation",reason:"subreaper-lost"}`. Re-exec discards old registrations and sweeps abandoned descendants before new work starts. If the worker is SIGKILLed, the guardian sweeps all remaining descendants before exiting, so cleanup does not depend on a worker exit handler.

Container mode runs each job beneath its own `tini -s -g --` child subreaper, installed by the runtime Docker stage. Detached and double-forked descendants reparent to that subreaper even if they clear or forge environment variables. Ownership follows kernel ancestry and the subreaper PID start time. Cleanup freezes descendants, kills them deepest first, rescans until empty, and then kills the subreaper. Every signal rechecks the target start time. RSS monitoring and restart recovery use the same ancestry. The supervisor cleans up after payload exit or worker death. `AIRDESIGN_JOB_DIRECTORY` routes job files only; it grants no process ownership. The entrypoint still drops privileges before starting the worker.

Container mode uses a separate process group for each job, private job and temporary directories, prlimit CPU, address-space, data-segment, file-size and descriptor limits, V8 heap limits, a wall-clock kill, cancellation checks, and recursive cleanup. Imports and images have an 8 GiB virtual-address ceiling. Chromium export requires a larger virtual-address ceiling of 4 TiB because Chromium reserves large virtual ranges. Both have a 768 MiB data-segment limit; virtual limits do not equal resident-memory guarantees. Job environments exclude service credentials. Existing archive, SVG, font, size, and image validation remains in place.

A preload rejects fetch, WebSocket construction, socket connections, HTTP and HTTPS requests, TLS, UDP, and DNS calls in job code. PDF Chromium additionally runs offline and aborts routed requests. This is application-level network denial, not a kernel network namespace. Code execution through a compromised native parser or a newly spawned executable can bypass JavaScript guards. Container mode also lacks per-job filesystem namespaces, cgroup RSS enforcement, and systemd accounting. It is weaker than systemd plus bubblewrap. The Railway service container is the remaining OS boundary; use separate worker credentials and no public worker port.

The worker only needs database access and the authenticated web job endpoint. Import, image, and export children receive neither credential. Never describe this mode as equivalent to hostile-code sandboxing.

Process ownership in container mode has a defined boundary. It guarantees that no export or Chromium process outlives its job after normal exit, crash, CPU, memory or wall-clock limits, cancellation, or worker restart, and that cleaning one job never signals another job's processes. Job code runs as the same Unix user as the worker, its guardian and the subreapers, so a payload that gains arbitrary code execution can signal those supervisors: it can stop the worker, fail concurrent jobs, or leave a detached process behind. Containing that case needs a separate job user started by a privileged launcher, or the systemd and bubblewrap mode, which Railway does not provide. Treat any such event as a security incident, not an export failure.

## Verify and roll back

Before deployment run the root build, tests, type check, lint, and `verify:pr-01` through `verify:pr-09`. P03 operation tests execute under both isolation modes. Rehearse sign-in against a local mail mock, fixture import, saved edits, PPTX and PDF export through the worker, and OAuth authorization and revocation. Keep proof with the release record.

Record the previous immutable image, site artifact, environment configuration, database schema, and queue version. Follow [the release and rollback procedure](operate.md) for consistent PostgreSQL and SQLite backups. Stop worker claims before replacing binaries. Fence active leases, restore compatible artifacts, deploy web, verify `/healthz`, then restart worker. Restore the previous Pages artifact separately. A binary rollback does not reverse saved edits, payments, or migrations. Replay deletion tombstones before enabling access after any database restore.

Aira selects the Claude Agent SDK when the AirDesign Claude key is set, with the Anthropic key as fallback. The model defaults to `claude-sonnet-5-5`. Without a key, Aira is unavailable; manual editing remains enabled. Deterministic drafting is used only by tests and release replays.

## Volume ownership

Railway mounts volumes as root. Both services start through `scripts/docker/entrypoint.sh`, which runs as root only long enough to give the `node` user `/data` and `/home/node/tmp`, then drops to `node` with `setpriv`, disables privilege escalation and clears capabilities before execing the worker subreaper or web Node process. The app itself never runs as root.

## Service role

One image serves both services. `AIRDESIGN_ROLE` selects the Node entry file: unset or `web` runs `node apps/server/src/main.ts`, `worker` runs `node apps/worker/src/service.ts`. The entrypoint execs the selected role so SIGTERM reaches the app or worker subreaper. Set `AIRDESIGN_ROLE=worker` on the worker service. Railway may ignore an uploaded `railway.json` start command, so the role variable is the source of truth. The role is declared in `.railway/railway.ts`.

Worker artifact completion uses an authenticated binary PUT to `/internal/worker` with queue, operation ID and lease query parameters, followed by a separate JSON completion report. Uploads spool to private disk in bounded chunks and reject more than 500 MiB as they arrive; reports are limited to 8 MiB. The existing SQLite artifact commit still reads the accepted artifact once into a Buffer. Public upload limits are unchanged. Abandoned upload files are removed when the web process starts.

The worker journals export scratch and the job subreaper PID with its start-time identity on its persistent jobs volume before rendering. On restart it kills abandoned descendants, removes their private snapshots and then records failure. Journal ownership remains until scratch removal succeeds.

## Verify the deployed commit and journey

Expose the image build identity through Railway's `RAILWAY_GIT_COMMIT_SHA` (GitHub deploys) or, outside Railway, Docker build argument `AIRDESIGN_BUILD_SHA`. An optional `AIRDESIGN_BUILD_TIME` fixes the UTC build timestamp. The build writes the identity once; web `/version` and site `/version.json` serve that identity. Build the Pages artifact from the same commit. A runtime environment change cannot relabel an old artifact.

Set `AIRDESIGN_SMOKE_EMAILS` on the web service to a dedicated smoke email, or a comma-separated allowlist. Leave it unset to disable operator minting. The CLI reuses `AIRDESIGN_DATABASE_URL` (or `DATABASE_URL`), `AIRDESIGN_SECRET`, and `AIRDESIGN_PUBLIC_ORIGIN`; it needs no additional secret. Do not add a public mint endpoint or enable the inbox. The smoke account must start empty.

After every web, worker or Pages deploy, run the [verify-live skill](../../.agents/skills/verify-live/SKILL.md) from the checkout of the deployed commit:

```sh
npm run verify:live -- --expect-sha "$(git rev-parse HEAD)" --smoke-email "$AIRDESIGN_SMOKE_EMAIL" --railway
```

The runner executes `railway ssh --service web -- node apps/server/src/smoke/mint-link.ts <smoke-email>` just before sign-in. It keeps the one-use, two-minute link in process memory. Container execution and the explicit allowlist authorize this operator path. It uses C09's normal session and atomic link-consumption behavior without changing emailed-link expiry or exposing a new HTTP capability. Never print or retain the credential.

A passing health check alone is insufficient. Keep the JSON receipt, screenshots, and exports with the release record. Treat any failed step as a failed release; fix or roll back and rerun the complete journey. The completed import report must identify the worker with the expected baked SHA. Browser errors remain fatal throughout sign-in and the signed-in journey. The receipt lists any named browser exceptions and their reasons. The verifier checks every public site page and its links, production access boundaries, build identity, persisted editing, both worker export formats, and smoke-account cleanup without spending on Aira.
