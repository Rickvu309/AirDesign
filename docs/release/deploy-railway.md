# Deploy AirDesign on Railway

## Configure the services

Build the root Dockerfile with Node 24. The image builds Studio, the public site, the PDF renderer, and the MCP capture renderer. Its runtime installs production npm dependencies, Playwright Chromium, browser system libraries, and util-linux. Run as the image's unprivileged node user.

Use `railway.json` for `web` and `railway.worker.json` for `worker`. Both services use the same image. Do not scale either service beyond one replica in this release.

| Service | Command | Storage | Health check |
| --- | --- | --- | --- |
| web | `npm run start:web` | Persistent writable volume mounted at `/data` | GET `/healthz`, 200 only after a live database query |
| worker | `npm run start:worker` | Separate persistent volume mounted at `/data` | Process supervision; no public listener |
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

Container mode uses a separate process group for each job, private job and temporary directories, prlimit CPU, address-space, data-segment, file-size and descriptor limits, V8 heap limits, a wall-clock kill, cancellation checks, and recursive cleanup. Imports and images have an 8 GiB virtual-address ceiling. Chromium export requires a larger virtual-address ceiling of 4 TiB because Chromium reserves large virtual ranges. Both have a 768 MiB data-segment limit; virtual limits do not equal resident-memory guarantees. Job environments exclude service credentials. Existing archive, SVG, font, size, and image validation remains in place.

A preload rejects fetch, WebSocket construction, socket connections, HTTP and HTTPS requests, TLS, UDP, and DNS calls in job code. PDF Chromium additionally runs offline and aborts routed requests. This is application-level network denial, not a kernel network namespace. Code execution through a compromised native parser or a newly spawned executable can bypass JavaScript guards. Container mode also lacks per-job filesystem namespaces, cgroup RSS enforcement, and systemd accounting. It is weaker than systemd plus bubblewrap. The Railway service container is the remaining OS boundary; use separate worker credentials and no public worker port.

The worker only needs database access and the authenticated web job endpoint. Import, image, and export children receive neither credential. Never describe this mode as equivalent to hostile-code sandboxing.

## Verify and roll back

Before deployment run the root build, tests, type check, lint, and `verify:pr-01` through `verify:pr-09`. P03 operation tests execute under both isolation modes. Rehearse sign-in against a local mail mock, fixture import, saved edits, PPTX and PDF export through the worker, and OAuth authorization and revocation. Keep proof with the release record.

Record the previous immutable image, site artifact, environment configuration, database schema, and queue version. Follow [the release and rollback procedure](operate.md) for consistent PostgreSQL and SQLite backups. Stop worker claims before replacing binaries. Fence active leases, restore compatible artifacts, deploy web, verify `/healthz`, then restart worker. Restore the previous Pages artifact separately. A binary rollback does not reverse saved edits, payments, or migrations. Replay deletion tombstones before enabling access after any database restore.

Aira selects the Claude Agent SDK when the AirDesign Claude key is set, with the Anthropic key as fallback. The model defaults to `claude-sonnet-5-5`. Without a key, Aira is unavailable; manual editing remains enabled. Deterministic drafting is used only by tests and release replays.

## Volume ownership

Railway mounts volumes as root. Both services start through `scripts/docker/entrypoint.sh`, which runs as root only long enough to give the `node` user `/data` and `/home/node/tmp`, then drops to `node` with `setpriv` before starting the app. The app itself never runs as root.
