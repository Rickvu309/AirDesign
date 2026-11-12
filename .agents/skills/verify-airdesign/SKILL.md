---
name: verify-airdesign
description: "Drive the real AirDesign app (apps/web product UI served with the real apps/api server on its own Postgres) the way a user does, capture proof (screenshots, ARIA snapshots, API answers, proof.md under ~/tmp/verify-airdesign/<run>/), and look at it as a design: ranked design faults, the real page beside its design screen, a contact sheet of every state, and an annotated before and after image for the PR. Use to prove a change to the editor, import, save, deck list, Trash, sign-in or anything a person sees."
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
- `apps/site`, marketing and the sign-in pages. Served on a second origin of the same stack (`siteOrigin` in the launch line, `kit.siteOrigin`): its sign-in paths go to the API the way the site's Worker sends them, and its pages come from a build made with a placeholder app address that the front server swaps for the stack's app origin. The app's signed-out redirect goes to `https://airdesign.app/sign-in`, built into `apps/web`; the journey kit answers every `airdesign.app` address with a stand-in page so no journey reaches production, and `kit.useSite()` sends `https://airdesign.app/sign-in` to the site origin instead. See `features/sign-in.md`.
- `packages/mcp`, the agent tools, mounted by the API at `/mcp`. Secondary. Its tests in `apps/api/src/mcp.test.ts` are the driver today.

## Launch

```sh
$V launch
```

It builds `@airdesign/api` with its workspace dependencies and `apps/web` (about 10 s warm), then starts a detached `serve` process that:

1. starts an empty PostgreSQL 18 cluster with `startEmptyCluster` from `apps/api/src/postgres-setup.ts` (data under `~/tmp/airdesign-api-*`, free port),
2. runs the real `runBootstrap` and `runSetup` (roles, schema, migrations),
3. starts `createApi` on a free port with an in-memory original store and a mail sender that writes each mail to the run's scratch `mail.jsonl`,
4. starts a front server on a free port that sends API paths to the API and every other path to `apps/web/dist` (single-page fallback), and a site server on another free port that sends the sign-in and sign-out paths to the API and every other path to the site build. The site build (`astro build`, about 5 s) is cached under `~/tmp/verify-airdesign-cache/site-<hash of apps/site, packages/theme and packages/catalog sources>`, so a launch at a source state already built costs nothing. The API's redirects to its placeholder origins (`https://app.example`, `https://site.example`) are rewritten to the two real origins.

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

Needs PostgreSQL 18 at `/usr/lib/postgresql/18/bin`, `~/.local/pgsql-18/...`, or `AIRDESIGN_POSTGRES_BIN`, and Playwright's Chromium (`pnpm exec playwright install chromium` once per machine). Run `pnpm install` first in a fresh worktree. On a machine where Chromium's system libraries live in `~/.cache/chromium-libs/root/usr/lib/x86_64-linux-gnu`, every command here, `pnpm test:journeys`, `pnpm test:browser` and `$V suites` add that folder to `LD_LIBRARY_PATH` themselves; set nothing.

## Doctor

```sh
$V doctor <run>
```

Read-only. Prints `{"ok":true,...,"checks":{...}}` and exits 1 when any check fails:

- `serveOwned`, `postgresOwned`: the recorded PIDs are alive and their command lines carry this run, so the instance is ours.
- `webServed`: `/` returns the AirDesign page.
- `apiCommit`, `buildIsHead`: the API reports the commit it was launched at, and that commit is the checkout's `HEAD`. When `buildIsHead` is false you edited or moved since launch: stop and launch again.
- `databaseAnswers`: `deckRoutes.list` without a cookie answers 401 `session`, which needs the API and Postgres both up.

Doctor also prints `load`, the machine's one-minute load average on its cores. Above the core count it says the machine is busy: a timeout then may be load, so rerun that step alone before you believe it. When the stack is gone it prints `next`, naming `stack.log`, where the stack writes the signal or the uncaught error that stopped it.

Run doctor first whenever anything looks off. Never drive an instance whose doctor fails or that another run started. Gate each drive on it: `$V doctor <run> >/dev/null && $V journey <run> <name>`.

## Drive

Journeys are Playwright scripts in `.agents/skills/verify-airdesign/journeys/`. Run one with:

```sh
$V journey <run> open-edit-save
```

Every file in `journeys/` is a shipped journey, listed in `tests/journeys/journeys.spec.ts`. `features/README.md` names the feature each one proves, and each feature file names its journeys and steps.

A failed journey saves a `failure` screenshot and writes the whole error, with the locator and the call log, to `failure.txt` in its evidence dir; `proof.md` names that file.

## Every journey after every merge

The `journeys` workflow runs every journey on every push to `main`, after the merge, as its own job. It does not run on pull requests and blocks no merge. One command runs the same suite locally from the repo root:

```sh
pnpm test:journeys
```

It builds `@airdesign/api` and `apps/web` once, launches one stack with `$V launch --no-build` in Playwright's global setup, runs every journey listed in `tests/journeys/journeys.spec.ts` against that one stack (each signs in its own account), and stops the stack in teardown. Journeys run in parallel, except the `recorded Aira` group: the stack has one queue of recorded model streams, so the journeys that call `kit.aira()` run one after another. Put a new one in that group. Evidence lands under `~/tmp/verify-airdesign/<run>/` as usual. No test retries.

When it fails on `main`, the workflow opens the issue `journey failed on main` (or comments on the open one) with the failed journey, the commit and the run link, through `scripts/red-main.sh`. The next passing push closes it. A known bug is a journey marked `test.fail()` in the spec; `scripts/metrics.mjs` counts it in `known-failures`, and the fix removes the mark.

To prove something no journey covers, write a new journey file there (or a scratch one under `~/tmp`, copied into `journeys/` for the run) that exports `default async function drive(kit)`. The kit gives you:

- `page`, `context`: a fresh Chromium page at the design's 1470x923 viewport, device scale 2 and reduced motion, with `baseURL` set to the run's origin. Captures wait for fonts and images. A journey may override the viewport when its purpose needs another size.
- `signIn()`: real sign-in through `signInRoutes.email` and the emailed code on `signInRoutes.code`, then sets the session cookie on the browser. Returns `{ email, cookie }`.
- `post(route, body, cookie, headers)`: POST to a catalog route entry; saves the request and answer as JSON evidence. An NDJSON answer lands in `json.lines`, an event stream in `json.events`.
- `deckRoutes`, `signInRoutes`, `accountRoutes`, `oauthRoutes`, `airaRoutes`, `mcpRoutes`: the catalog tables.
- `aira(scripts)`: the recorded model streams the next Aira calls play, one per call, the last one repeating. See `features/aira-turn.md`.
- `mail(to)`: the last mail the stack sent to that address, `{ to, subject, text, html }`, also saved as `mail.json` in the evidence dir.
- `mailParts(to)`: that mail with its `code` and its `link`, the link already pointing at the stack's app origin so a page can open it.
- `siteOrigin`, `useSite()`: the origin of the site's pages, and the call that sends the app's sign-in address to it. A journey that walks the sign-in pages calls `useSite()` first and visits `${siteOrigin}/sign-in`.
- `countryHeader`: the catalog's visitor-country header name, for sending another country through `post`.
- `capture(label)`: screenshot plus ARIA snapshot of the page.
- `note(line)`: append a line to the run's `proof.md`.
- `repo`: the checkout root, for fixtures such as `scripts/pptx-fixtures/clean.pptx`.

Use `expect` from `@playwright/test`. A thrown error fails the journey, captures a `failure` screenshot and exits 1.

Stable handles in the app today: `input[type=file]` on Home (import), `[contenteditable="true"]` (text box being edited), `[data-slide-paint]` (slide canvas), `[data-canvas-element="<key>"]` (painted element; thumbnail tables carry it too, so scope it to `[data-slide-paint]`), `[data-thumb-paint]` (thumbnail), `[data-slide-entry="<n>"]` (slide list entry), `[data-selection]` and `[data-grip]` (selection frame), `[data-editor-panel]` (Agent panel), `[data-step-mark]` (Aira step mark), `.thin-page[data-deck-ready]` (deck painted), roles and names such as `button "New deck"`, `button "Add slide"`, `button "Add text box"`, `button "Undo <step>"`, `button "Move to Trash"`, `button "Restore"`, `button "Empty Trash"`, `button "Export"`, `heading "<deck name>"`.

Plain HTTP without a browser:

```sh
$V sign-in <run>                                   # {"email":"...","cookie":"airdesign.session=..."}
$V api <run> list '{}' --cookie 'airdesign.session=...'
$V api <run> open '{"deck":"<id>"}' --cookie '...'
```

`api` takes a `deckRoutes` key (`open`, `commit`, `watch`, `list`, `rename`, `trash`, `restore`, `delete`, `originalUpload`, `originalDone`, `original`) and saves the answer under the evidence dir.

## Look at it

Working is not the same as looking right. For every change a person sees:

1. Find the states your change touches with `$V states`. Run `$V look <run> <state>` on each, before your change and after. A page no state covers: `$V look <run> <path>`, with `--import deck.pptx --slide n` for a slide.
2. Run `$V compare <run> <state>` to put the state beside its design screen under `/screens/`.
3. Open `annotated.png`, `compare.png` and the crops, and read them. Then write two or three sentences on what you see, as a designer would: what draws the eye, what looks off, how it differs from the design.
4. Fix every finding or explain it. A finding that is meant gets an entry in `look/allow.json` with a reason; a real fault you leave gets a `test.fail` in `tests/browser/design-states.spec.ts`. When you add a state a person can reach, add `look/states/<name>.mjs`, one file.
5. Put the image paths, your sentences, and the finding counts before and after in the PR body.

`$V sheet <run>` does all states at once and writes a contact sheet a person can open.

Zero findings is not a design sign-off. The tool cannot judge taste, hierarchy, whether words are true for their situation, or whether a flow makes sense; only your reading of the images can. `look/README.md` lists what each detector reads and cannot see.

## Before / after in the PR

Every PR that changes what a person sees gets a `## Before / after` section. The `bar` check labels a PR without one `needs-before-after`.

1. Write a callouts file, one block per changed state from `$V states`:

   ```json
   [
     {
       "state": "agent-empty",
       "title": "Agent panel, empty",
       "crop": "[data-editor-panel]",
       "callouts": [{ "at": "[data-aira-welcome] h2", "note": "Empty panel names Aira and what to check (was blank)" }]
     }
   ]
   ```

   `crop` and `at` are CSS selectors, or a box `{"x","y","width","height"}` in CSS px. An arrow points at the words inside `at`'s element, or at the element when it holds none, so a centered heading in a wide block gets its arrow on the heading. `click` lists selectors to click after the state is reached. A note is one sentence that names what changed and by how much: "Card corners 22px to 16px", "Step reads Edited the deck, not airdesign_edit_deck". Never "Improved styling".

2. Run `$V before-after callouts.json`. It builds and launches the merge base with `origin/main` in a scratch worktree, launches this checkout, drives each state on both with that side's own journey, and writes `annotated-N.png`, each full screenshot, and `before-after.md`. `--base` and `--head` take other commits. `--keep` keeps both stacks and prints their runs, so the next try takes `--before-run` and `--after-run` and costs seconds. Stop them with `$V stop` when done.
3. Open every `annotated-N.png`. Check each arrow points at the thing its note names on both sides, each note is true, and a stranger sees what changed in ten seconds. A selector missing on one side shows a grey number and says so in the legend; that is right only when the thing is new or gone.
4. `$V publish <out-dir> --pr <number>` uploads the PNGs to the `proof` release and writes `before-after.published.md`. Paste it into the PR body as is.

`$V annotate <run> callouts.json` draws the same callouts on one run, for a comment or a `look`.
`$V comment <pr> <markdown-file>` posts a pull request comment prefixed with the agent line `🤖 **AI Agent responding on behalf of Quan Vu**`. Always post PR comments with this command.

## Saved proof

Everything lands in `~/tmp/verify-airdesign/<run>/` and survives `stop`:

- `proof.md`: the commit, the origin, one line per `note`, each journey's PASSED or FAILED, and what `stop` stopped.
- `<journey>-<ms>/NN-<label>.png` and `.aria.txt`: the screen after each step.
- `<journey>-<ms>/NN-api-<path>.json` and `api-<route>-<ms>.json`: request and answer bodies.

Proof standards:

- Drive the user's path: the file input on Home, typing in the slide, the buttons on Home and Trash. Never call internal setters or test-only routes.
- Capture the action and the result, not only the last screen.
- Prove side effects through a second view: after a UI action, read the server copy with `deckRoutes.open` or `deckRoutes.list`. A UI that looks right while the server disagrees is a failure.
- The only stand-ins are the mail sender (writes a file instead of calling Resend), the original store (in memory instead of R2, its signed URLs served by the front server under `/verify-original/`), Aira's model (`bin/scripted-aira.mjs` plays recorded streams instead of calling Claude), the country header (the front server adds `visitor-country: US` as the web worker would from Cloudflare's `request.cf.country`), and production pages (the journey kit answers any `airdesign.app` address, such as the sign-in redirect, with a stand-in page). Each sits behind a production seam. The stack sends no forward secret, so the API's forward-secret check is not exercised.
- Put the run id, the journey and the evidence path in your PR or review comment.

## Cleanup

```sh
$V stop <run>
```

Stops only this run: it sends SIGTERM to the recorded `serve` PID after checking its command line names this run, which stops the API, the front server and Postgres. If Postgres outlives it, it signals the recorded postmaster PID after checking its command line names this run's data dir. It then removes the run's cluster dir and scratch dir (`~/tmp/verify-airdesign-scratch/<run>/`). It never kills by name and never touches a process another run or agent started. Before it removes the scratch dir it copies `stack.log` into the evidence dir. It prints `left: []` when nothing of the run is alive and `evidenceKept: true`.

Run `stop` after every run, passed or failed. A failed `launch` prints the run id in its log path; stop that run too.

## Isolation and load

- Every run has its own ports, Postgres cluster, scratch dir and evidence dir. Two runs, from two agents or two worktrees, do not see each other.
- The machine's cores are shared by many agents. Run one journey at a time, stop as soon as you have the proof, and do not run this while your own `pnpm check` runs.
- `launch` writes the load average into `proof.md`, and every journey's PASSED or FAILED line says the load it finished under. Quote it with a result: "passed at load 42 on 16 cores".
- `pnpm check` takes a machine lock; `$V suites --run` takes the same lock; the other commands do not.

## Which suites to run

`pnpm check` skips the browser tests on this machine, and `ci` runs them. A change that passes only its own new spec can still break others. Before you push, run what your change needs:

| Changed paths                                                                               | Suites                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| anything                                                                                    | `pnpm check`                                 |
| `apps/web`, a package `apps/web` imports, `tests/browser`, this skill's `look/`             | the whole browser suite, `pnpm test:browser` |
| `apps/web`, `apps/api`, any package they import, `tests/journeys`, this skill               | every journey, `pnpm test:journeys`          |
| the paths `ci`'s `pptx` job watches (`packages/pptx`, `packages/document`, `apps/web`, ...) | `pnpm check:pptx`                            |

`pnpm check:pptx` finds the .NET 8 SDK itself: `PPTX_DOTNET`, then `dotnet` on PATH, then `$DOTNET_ROOT/dotnet`, then `~/.dotnet/dotnet`. It adds Chromium's library folder itself too. Set nothing; when no SDK is found it lists the places it tried.

One command reads the branch's changes against `origin/main` and does it:

```sh
$V suites            # which suites this branch needs, and why
$V suites --run      # run them in order under the machine lock, with Chromium's libraries set
$V suites --run browser -- tests/browser/home.spec.ts:12   # one suite, one test
```

`--run` writes `suites.md` under `~/tmp/verify-airdesign/suites-<time>/` with each suite's result, time and the load it ran under. When a suite fails it lists the failed tests and prints the command that reruns only them; run it before you call a failure real. The rules read `apps/web` and `apps/api`'s workspace dependencies and `ci.yml`, so they follow the repo.

## Feature map

`features/README.md` indexes the user features and how to prove each. Read it before driving.

## Helpers

- `bin/verify-airdesign.mjs`: the entry point for every command. `$V` with no command prints usage.
- `look/`: the design commands' parts: the detectors, the state list, compare, the sheet, and the callouts, placement and drawing behind `before-after` and `annotate`. See `look/README.md`.
- `bin/proof.mjs`, `bin/publish.mjs` and `bin/comment.mjs`: `before-after`, `annotate`, `publish` and `comment`.
- `bin/suites.mjs`: `suites`. `bin/load.mjs`: the load line. `bin/browser.mjs`: Chromium's launch, with its library folder.
- `journeys/*.mjs`: Playwright journeys run by `$V journey <run> <name>` and by `pnpm test:journeys`.
