---
name: verify-airdesign
description: "Drive the real AirDesign app (apps/web product UI served with the real apps/api server on its own Postgres) the way a user does, and capture proof: screenshots, ARIA snapshots, API answers and a proof.md under ~/tmp/verify-airdesign/<run>/. Use before review to prove a change to the editor, import, save, deck list, Trash or sign-in, and as a verifier to check a PR in one pass."
---

# Verify AirDesign

One command starts a private copy of AirDesign: the built `apps/web` bundle and the real `apps/api` server behind one origin, on a fresh PostgreSQL 18 cluster. Every port is free-picked, every data dir is new, and nothing is shared with another agent. You drive it with the repo's Playwright (`@playwright/test` 1.65.0) and with plain HTTP using paths from `packages/catalog/src/deck-routes.ts` (`deckRoutes`, `signInRoutes`). Never type an API path by hand.

The helper is `.agents/skills/verify-airdesign/bin/verify-airdesign.mjs` (Claude Code also sees it at `.claude/skills/verify-airdesign/`). Run it from the repo root. Below, `V` means that path:

```sh
V=.agents/skills/verify-airdesign/bin/verify-airdesign.mjs
```

## Surfaces

- `apps/web`, the product UI. Primary. Home `/`, Trash `/trash`, a deck `/deck/<id>`. Designed screens at `/screens/<id>-<name>` are static sample pages, not the app.
- `apps/api`, the server. Reached through the same origin for every path in its own route table (`routes` in `apps/api/src/server.ts`), so the browser sends its session cookie the way production does.
- `apps/site`, marketing and the sign-in form. Not served by this stack. Sign-in is driven through the same API calls the form makes (`signInRoutes.email`, `signInRoutes.code`). See `features/sign-in.md`.
- `packages/mcp`, the agent tools, mounted by the API at `/mcp`. Secondary. Its tests in `apps/api/src/mcp.test.ts` are the driver today.

## Launch

```sh
$V launch
```

It builds `@airdesign/api` with its workspace dependencies and `apps/web` (about 10 s warm), then starts a detached `serve` process that:

1. starts an empty PostgreSQL 18 cluster with `startEmptyCluster` from `apps/api/src/postgres-setup.ts` (data under `~/tmp/airdesign-api-*`, free port),
2. runs the real `runBootstrap` and `runSetup` (roles, schema, migrations),
3. starts `createApi` on a free port with an in-memory original store and a mail sender that writes each mail to the run's scratch `mail.jsonl`,
4. starts a front server on a free port that sends API paths to the API and every other path to `apps/web/dist` (single-page fallback).

Ready means all of that finished and the state file says `ready: true`. Launch prints one JSON line:

```json
{
  "run": "2026-11-11T08-19-10-445Z-c8e1b2",
  "origin": "http://127.0.0.1:40455",
  "evidence": "/home/quan/tmp/verify-airdesign/2026-11-11T08-19-10-445Z-c8e1b2",
  "pid": 414637
}
```

Keep the `run`. Every other command takes it. Use `$V launch --no-build` only when you built this exact checkout already. A build or start failure names its log file.

Needs PostgreSQL 18 at `/usr/lib/postgresql/18/bin`, `~/.local/pgsql-18/...`, or `AIRDESIGN_POSTGRES_BIN`, and Playwright's Chromium (`pnpm exec playwright install chromium` once per machine). Run `pnpm install` first in a fresh worktree.

## Doctor

```sh
$V doctor <run>
```

Read-only. Prints `{"ok":true,...,"checks":{...}}` and exits 1 when any check fails:

- `serveOwned`, `postgresOwned`: the recorded PIDs are alive and their command lines carry this run, so the instance is ours.
- `webServed`: `/` returns the AirDesign page.
- `apiCommit`, `buildIsHead`: the API reports the commit it was launched at, and that commit is the checkout's `HEAD`. When `buildIsHead` is false you edited or moved since launch: stop and launch again.
- `databaseAnswers`: `deckRoutes.list` without a cookie answers 401 `session`, which needs the API and Postgres both up.

Run doctor first whenever anything looks off. Never drive an instance whose doctor fails or that another run started.

## Drive

Journeys are Playwright scripts in `.agents/skills/verify-airdesign/journeys/`. Run one with:

```sh
$V journey <run> open-edit-save
```

Shipped journeys: `open-edit-save`, `deck-list-trash`, `slide-paint`, and `cleared-browser` (a deck reopened in a cleared browser is rebuilt from the original the server keeps). Each feature file in `features/` names its journey and steps.

## Every journey after every merge

The `journeys` workflow runs every journey on every push to `main`, after the merge, as its own job. It does not run on pull requests and blocks no merge. One command runs the same suite locally from the repo root:

```sh
pnpm test:journeys
```

It builds `@airdesign/api` and `apps/web` once, launches one stack with `$V launch --no-build` in Playwright's global setup, runs every journey listed in `tests/journeys/journeys.spec.ts` in parallel against that one stack (each signs in its own account), and stops the stack in teardown. Evidence lands under `~/tmp/verify-airdesign/<run>/` as usual. No test retries.

When it fails on `main`, the workflow opens the issue `journey failed on main` (or comments on the open one) with the failed journey, the commit and the run link, through `scripts/red-main.sh`. The next passing push closes it. A known bug is a journey marked `test.fail()` in the spec; `scripts/metrics.mjs` counts it in `known-failures`, and the fix removes the mark.

To prove something no journey covers, write a new journey file there (or a scratch one under `~/tmp`, copied into `journeys/` for the run) that exports `default async function drive(kit)`. The kit gives you:

- `page`, `context`: a fresh Chromium page at 1600x1000 with `baseURL` set to the run's origin, so `page.goto("/")` works.
- `signIn()`: real sign-in through `signInRoutes.email` and the emailed code on `signInRoutes.code`, then sets the session cookie on the browser. Returns `{ email, cookie }`.
- `post(route, body, cookie)`: POST to a `deckRoutes` or `signInRoutes` entry; saves the request and answer as JSON evidence.
- `deckRoutes`, `signInRoutes`: the catalog tables.
- `capture(label)`: screenshot plus ARIA snapshot of the page.
- `note(line)`: append a line to the run's `proof.md`.
- `repo`: the checkout root, for fixtures such as `scripts/pptx-fixtures/clean.pptx`.

Use `expect` from `@playwright/test`. A thrown error fails the journey, captures a `failure` screenshot and exits 1.

Stable handles in the app today: `input[type=file]` on Home (import), `[contenteditable="true"]` (text box being edited), `[data-slide-paint]` (slide canvas), `[data-canvas-element="<key>"]` (painted element), `[data-slide-entry="<n>"]` (slide list entry), roles and names such as `button "New deck"`, `button "Move to Trash"`, `button "Restore"`, `button "Empty Trash"`, `button "Export"`, `heading "<deck name>"`.

Plain HTTP without a browser:

```sh
$V sign-in <run>                                   # {"email":"...","cookie":"airdesign.session=..."}
$V api <run> list '{}' --cookie 'airdesign.session=...'
$V api <run> open '{"deck":"<id>"}' --cookie '...'
```

`api` takes a `deckRoutes` key (`open`, `commit`, `watch`, `list`, `rename`, `trash`, `restore`, `delete`, `originalUpload`, `originalDone`, `original`) and saves the answer under the evidence dir.

## Evidence

Everything lands in `~/tmp/verify-airdesign/<run>/` and survives `stop`:

- `proof.md`: the commit, the origin, one line per `note`, each journey's PASSED or FAILED, and what `stop` stopped.
- `<journey>-<ms>/NN-<label>.png` and `.aria.txt`: the screen after each step.
- `<journey>-<ms>/NN-api-<path>.json` and `api-<route>-<ms>.json`: request and answer bodies.

Proof standards:

- Drive the user's path: the file input on Home, typing in the slide, the buttons on Home and Trash. Never call internal setters or test-only routes.
- Capture the action and the result, not only the last screen.
- Prove side effects through a second view: after a UI action, read the server copy with `deckRoutes.open` or `deckRoutes.list`. A UI that looks right while the server disagrees is a failure.
- The only stand-in is the mail sender (writes a file instead of calling Resend) and the original store (in memory instead of R2, its signed URLs served by the front server under `/verify-original/`). Both sit behind production seams.
- Put the run id, the journey and the evidence path in your PR or review comment.

## Cleanup

```sh
$V stop <run>
```

Stops only this run: it sends SIGTERM to the recorded `serve` PID after checking its command line names this run, which stops the API, the front server and Postgres. If Postgres outlives it, it signals the recorded postmaster PID after checking its command line names this run's data dir. It then removes the run's cluster dir and scratch dir (`~/tmp/verify-airdesign-scratch/<run>/`). It never kills by name and never touches a process another run or agent started. It prints `left: []` when nothing of the run is alive and `evidenceKept: true`.

Run `stop` after every run, passed or failed. A failed `launch` prints the run id in its log path; stop that run too.

## Isolation and load

- Every run has its own ports, Postgres cluster, scratch dir and evidence dir. Two runs, from two agents or two worktrees, do not see each other.
- The machine has 8 cores shared by many agents. Run one journey at a time, stop as soon as you have the proof, and do not run this while your own `pnpm check` runs.
- `pnpm check` takes a machine lock; this helper does not, and does not need to.

## Feature map

`features/README.md` indexes the user features and how to prove each. Read it before driving.

## Helpers

- `bin/verify-airdesign.mjs`: the only helper. `$V` with no command prints usage.
- `journeys/*.mjs`: Playwright journeys run by `$V journey <run> <name>` and by `pnpm test:journeys`.
