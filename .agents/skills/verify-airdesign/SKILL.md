---
name: verify-airdesign
description: "Prove an AirDesign change is right before you hand it over. Drive the real app (apps/web with the real apps/api on its own Postgres) the way a user does and read what saved, attack the bad moment, check the TLA+ rules and their replays, prove a PowerPoint export against its original, judge each screen as a design, and time the editor. Use for any change a person sees or the API answers, and when a change touches edit order, undo, saving and the save status, offline replay, two tabs, agent turns and runs, slides and elements, usage, OAuth or deck ownership, or when a spec or replay fails."
---

# Verify AirDesign

One command starts a private copy of AirDesign: the built `apps/web` bundle and the real `apps/api` server behind one origin, on a fresh PostgreSQL 18 cluster. Every port is free-picked, every data dir is new, and nothing is shared with another agent. You drive it with the repo's Playwright (`@playwright/test` 1.65.0) and with plain HTTP using paths from `packages/catalog/src/deck-routes.ts` (`deckRoutes`, `signInRoutes`) and `packages/catalog/src/doom-wire.ts` (`doomRoutes`, which opens and edits a deck). Never type an API path by hand.

The helper is `.agents/skills/verify-airdesign/bin/verify-airdesign.mjs` (Claude Code also sees it at `.claude/skills/verify-airdesign/`). Run it from the repo root. Below, `V` means that path:

```sh
V=.agents/skills/verify-airdesign/bin/verify-airdesign.mjs
```

Verify answers one question before you hand work over: is my work right? Name what would prove it wrong, run that, and fix what you find. Every check ends in passed, failed or open, with the file that shows it.

```text
Is my work right?
├─ A. Correct: does it do the right thing?
│   ├─ Works    use it like a person, read what saved       Works
│   ├─ Holds    survives bad timing and any event order     Holds, rules/README.md
│   └─ Exports  the PowerPoint comes out lossless           Exports
└─ B. Good to use: would a person want it?
    ├─ Looks    the screen matches its design, no faults    Looks
    └─ Fast     no slower than main                         Fast
```

Under both sit the private app (Run the app) and `prove`, which picks the checks a diff needs (Pick the proof). To show the result to a person, use `show-airdesign`.

## Run the app

### Surfaces

- `apps/web`, the product UI. Primary. Home `/`, Trash `/trash`, a deck `/s/<id>` (`/s` makes a new one). Designed screens at `/screens/<id>-<name>` are static sample pages, not the app.
- `apps/api`, the server. Reached through the same origin for every path in its own route table (`routes` in `apps/api/src/server.ts`), so the browser sends its session cookie the way production does.
- `apps/site`, marketing and the sign-in pages. Served on a second origin of the same stack (`siteOrigin` in the launch line, `kit.siteOrigin`): its sign-in paths go to the API the way the site's Worker sends them, and its pages come from a build made with a placeholder app address that the front server swaps for the stack's app origin. The app's signed-out redirect goes to `https://airdesign.app/sign-in`, built into `apps/web`; the journey kit answers every `airdesign.app` address with a stand-in page so no journey reaches production, and `kit.useSite()` sends `https://airdesign.app/sign-in` to the site origin instead. See `features/sign-in.md`.
- `packages/mcp`, the agent tools, mounted by the API at `/mcp`. Secondary. Its tests in `apps/api/src/mcp.test.ts` are the driver today.

### Launch

```sh
$V launch
```

It builds `@airdesign/api` with its workspace dependencies and `apps/web` (about 10 s warm), then starts a detached `serve` process that:

1. starts an empty PostgreSQL 18 cluster with `startEmptyCluster` from `apps/api/src/testing/postgres-setup.ts` (data under `~/tmp/airdesign-api-*`, free port),
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

### Doctor

```sh
$V doctor <run>
```

Read-only. Prints `{"ok":true,...,"checks":{...}}` and exits 1 when any check fails:

- `serveOwned`, `postgresOwned`: the recorded PIDs are alive and their command lines carry this run, so the instance is ours.
- `webServed`: `/` returns the AirDesign page.
- `apiCommit`, `buildIsHead`: the API reports the commit it was launched at, and that commit is the checkout's `HEAD`. When `buildIsHead` is false you edited or moved since launch: stop and launch again.
- `databaseAnswers`: `deckRoutes.list` without a cookie answers 401 `session`, which needs the API and Postgres both up.

Doctor also prints `load`, the machine's one-minute load average on its cores. Above the core count it says the machine is busy. A step that fails then and passes alone has found a race: force the gap and fix it. When the stack is gone it prints `next`, naming `stack.log`, where the stack writes the signal or the uncaught error that stopped it.

Run doctor first whenever anything looks off. Never drive an instance whose doctor fails or that another run started. Gate each drive on it: `$V doctor <run> >/dev/null && $V journey <run> <name>`.

### Cleanup

```sh
$V stop <run>      # or: $V stop, for every run this worktree started
```

Never kill processes you did not start, and never by name: `stop` is the cleanup, and it only touches this worktree's stacks. It refuses a run whose `owner` file (written atomically when the run starts, never rewritten) names another worktree, or whose state cannot be read. Launch's sweep of dead runs also skips other worktrees' runs. Stops only this run: it sends SIGTERM to the recorded `serve` PID after checking its command line names this run, which stops the API, the front server and Postgres. If Postgres outlives it, it signals the recorded postmaster PID after checking its command line names this run's data dir. It then removes the run's cluster dir and scratch dir (`~/tmp/verify-airdesign-scratch/<run>/`). It never kills by name and never touches a process another run or agent started. Before it removes the scratch dir it copies `stack.log` into the evidence dir. It prints `left: []` when nothing of the run is alive and `evidenceKept: true`.

Run `stop` after every run, passed or failed. A failed `launch` prints the run id in its log path; stop that run too. A run killed with its agent is cleaned up anyway: each `launch` first runs `stop` on every run whose `serve` process is gone, and removes run folders with no `state.json` after a day. It prints what it cleaned on stderr as `{"leftover": ...}` and never touches a run whose `serve` is alive.

### Isolation and load

Each run is isolated, and the machine is shared: read [isolation-and-load.md](isolation-and-load.md) before you run anything heavy.

## A. Correct

### Works

Journeys are Playwright scripts in `.agents/skills/verify-airdesign/journeys/`. Run one with:

```sh
$V journey <run> deck-list-trash
```

Every file in `journeys/` is a shipped journey, listed in `tests/journeys/journeys.spec.ts`. `features/README.md` names the feature each one proves, and each feature file names its journeys and steps.

A failed journey saves a `failure` screenshot and writes the whole error, with the locator and the call log, to `failure.txt` in its evidence dir; `proof.md` names that file.

For the full suite, CI sharding and journeys that use recorded Aira, see [journey suite](journey-suite.md).

To prove something no journey covers, write a journey that exports `default async function drive(kit)`: a new file there, or a scratch file anywhere, run by its path (`$V journey <run> ~/tmp/seam.mjs`). The kit gives you:

- `page`, `context`: a fresh Chromium page at the design's 1470x923 viewport, device scale 2 and reduced motion, with `baseURL` set to the run's origin. Captures wait for fonts and images. A journey may override the viewport when its purpose needs another size.
- `signIn(email?)`: real sign-in through `signInRoutes.email` and the emailed code on `signInRoutes.code`, then sets the session and account cookies on the browser, as production does. Returns `{ email, cookie }`. An earlier `email` signs that account in again.
- `expect`: Playwright's, for a scratch journey outside the repo, where `@playwright/test` does not resolve.
- `post(route, body, cookie, headers)`: POST to a catalog route entry; saves the request and answer as JSON evidence. An NDJSON answer lands in `json.lines`, an event stream in `json.events`.
- `deckRoutes`, `doomRoutes`, `signInRoutes`, `accountRoutes`, `oauthRoutes`, `airaRoutes`, `mcpRoutes`, `fontRoutes`: the catalog tables.
- `holdReply(route, { afterServer, forMs, search }?)`: returns `{ release, received }`. Await `release()` to let requests through and remove the hold. The runner releases outstanding holds on exit. Use `afterServer: true` and await `received` to stop after the server answers. Set `forMs` to open the hold that many milliseconds after the first match, or `search` to match one query string.
- `dropReply(route)`: sends the first request to the server and drops its reply, then blocks retries. Await `dropped` for `{ request, response }` and `restore()` to allow requests again.
- `failReply(route, { status, json }?)`: answers with a connection failure or the given HTTP status and JSON. Returns a `restore()` function.
- `aira(scripts)`: the recorded model streams the next Aira calls play, one per call, the last one repeating. See `features/aira-turn.md`.
- `mail(to)`: the last mail the stack sent to that address, `{ to, subject, text, html }`, also saved as `mail.json` in the evidence dir.
- `mailParts(to)`: that mail with its `code` and its `link`, the link already pointing at the stack's app origin so a page can open it.
- `siteOrigin`, `useSite()`: the origin of the site's pages, and the call that sends the app's sign-in address to it. A journey that walks the sign-in pages calls `useSite()` first and visits `${siteOrigin}/sign-in`.
- `countryHeader`: the catalog's visitor-country header name, for sending another country through `post`.
- `capture(label)`: screenshot plus ARIA snapshot of the page.
- `note(line)`: append a line to the run's `proof.md`.
- `repo`: the checkout root, for fixtures and for loading `packages/doom/dist/index.js` to read a fold (`readFold`) or compile an agent edit.

Stable handles in the app today: `[data-editor-ready="<deck>"]` (the deck painted), `[data-slide-box]` (the slide canvas), `[data-node="<id>"]` (a painted layer; thumbnails carry it too, so scope it to `[data-slide-box]`), `[data-slide-entry="<n>"]` (slide list entry), `[data-slide-thumb]` (its thumbnail), `[data-selection]` and `[data-grip]` (selection frame), `[data-hover-outline]`, `[data-text-editor]` (the text being edited), `[data-editor-panel]` (Agent and Design column), `[data-step-mark]` (Aira step mark), roles and names such as `button "New deck"`, `button "Add slide"`, `menuitem "Move to Trash"`, `heading "<deck name>"`. `look/doom-deck.mjs` and `look/doom-canvas.mjs` open a Doom deck with given layers and find a layer's centre.

Plain HTTP without a browser:

```sh
$V sign-in <run>                                   # {"email":"...","cookie":"airdesign.session=..."}
$V api <run> list '{}' --cookie 'airdesign.session=...'
$V api <run> open '{"deck":"<id>"}' --cookie '...'
```

`api` takes a `deckRoutes` key (`list`, `rename`, `star`, `trash`, `restore`, `delete`, `mediaUpload`, `media`) and saves the answer under the evidence dir. A deck's content is read and written through `doomRoutes` (`create`, `open`, `edit`, `since`, `pictures`, `run`); post those from a journey with `post`.

#### Saved proof

Everything lands in `~/tmp/verify-airdesign/<run>/` and survives `stop`:

- `proof.md`: the commit, the origin, one line per `note`, each journey's PASSED or FAILED, and what `stop` stopped.
- `<journey>-<ms>/NN-<label>.png` and `.aria.txt`: the screen after each step.
- `<journey>-<ms>/NN-api-<path>.json` and `api-<route>-<ms>.json`: request and answer bodies.

Proof standards:

- Drive the user's path: New deck on Home, typing in the slide, the buttons on Home and Trash. Never call internal setters or test-only routes.
- Capture the action and the result, not only the last screen.
- Prove side effects through a second view: after a UI action, read the server copy with `doomRoutes.open` or `deckRoutes.list`. A UI that looks right while the server disagrees is a failure.
- The stack has a few stand-ins, each behind a production seam. [stand-ins.md](stand-ins.md) lists them.
- Put the run id, the journey and the evidence path in your PR or review comment.

### Holds

Attack the moment your change could break: a lost or late server answer, a reload at the wrong step, a second tab. Hold, drop or fail a server answer in a journey with the kit's `holdReply`, `dropReply` and `failReply` (see Works); the stand-ins the stack already uses are in [stand-ins.md](stand-ins.md). For a rule about order (saves, undo, runs, tabs, the save status), check its TLA+ model and replay: [rules/README.md](rules/README.md) has the commands, how to read a counterexample, and every check's coverage.

### Exports

- Prove an export against its original with `node scripts/deck-diff.mjs original.pptx export.pptx --allow <part>`: it counts the byte-identical parts, shows each changed part's XML lines with their shape paths, and exits 1 when a part outside `--allow` changed, was added or removed, or the part order moved. `--json` prints the same as data. Run `pnpm build` first.
- Score a painted slide against its reference image with `node scripts/slide-diff.mjs reference.png painted.png [--heatmap out.png] [--json]`: it prints the mean similarity, the worst 32 by 32 tile with its position, and the share of changed pixels, and exits 1 when the slide does not match. The heatmap tints each region red where the paint differs and boxes the worst tile. The painted image is scaled to the reference's size first.

## B. Good to use

### Looks

For feedback about scale, alignment, names, or button borders, follow [the design review](look/design-review.md).

For every change a person sees:

1. Find the states your change touches with `$V states`. Run `$V look <run> <state>` on each, before your change and after. A page no state covers: `$V look <run> <path>`.
2. Run `$V compare <run> <state>` to put the state beside its design screen under `/screens/`.
3. Open `annotated.png`, `compare.png` and the crops, and read them. Then write two or three sentences on what you see, as a designer would: what draws the eye, what looks off, how it differs from the design.
4. Fix every finding or explain it. A finding that is meant gets an entry in `look/allow.json` with a reason; a real fault you leave gets a `test.fail` in `tests/browser/design-states.spec.ts`. When you add a state a person can reach, add `look/states/<name>.mjs`, one file.
5. Put your sentences and the finding counts before and after in the PR body, with the images published as [show-airdesign's annotate.md](../show-airdesign/annotate.md) says.

`$V sheet <run>` does all states at once and writes a contact sheet a person can open.

Zero findings is not a design sign-off. The tool cannot judge taste, hierarchy, whether words are true for their situation, or whether a flow makes sense; only your reading of the images can. `look/README.md` lists what each detector reads and cannot see.

### Fast

`$V bench` times what a person feels in the editor on a 40-slide deck (reopening it, dragging, typing, adding a slide, an agent's edit reaching the tab, and the idle tab) on the merge base and on this checkout, interleaved, under CPU throttle 4, and says `slower` only when the gap beats both spreads and 5 %. A PR that touches the editor's gestures pastes its table in `## Proof`. [bench.md](bench.md) has the cases, flags, verdict rule and output.

## Pick the proof

`pnpm gate` and `pnpm check` skip the browser tests on this machine, and `ci` runs them. Before `pnpm land`, run the proof your diff needs:

```sh
pnpm prove            # read the diff against origin/main, run what fits, write proof.md
pnpm prove --plan     # print the plan as JSON and run nothing
```

It runs the unit tests the changed sources reach, the script tests that import a changed script, the TLA+ specs whose covered code moved and their replays, a changed browser spec five times under a CPU limit, and `sheet` on the states of each touched screen area. Quote its `proof.md` in the PR's `## Proof`. [prove-and-suites.md](prove-and-suites.md) has the rules, the flags, the lanes, and `$V suites` for the whole suites `ci` runs.

## Show it to a person

Before / after images, callouts on one run, publishing to the `proof` release and PR comments are Show's job: follow [show-airdesign's annotate.md](../show-airdesign/annotate.md). The commands stay here in `$V`.

## Feature map

`features/README.md` indexes the user features and how to prove each. Read it before driving.

## Helpers

- `bin/verify-airdesign.mjs`: the entry point for every command. `$V` with no command prints the usage in `bin/usage.mjs`.
- `look/`: the design commands' parts: the detectors, the state list, compare, the sheet, and the callouts, placement and drawing behind `before-after` and `annotate`. See `look/README.md`.
- `bin/proof.mjs`, `bin/publish.mjs` and `bin/comment.mjs`: `before-after`, `annotate`, `publish` and `comment`.
- `bin/prove.mjs` and `bin/prove-plan.mjs`: `prove`. `bin/suites.mjs`: `suites`. `bin/load.mjs`: the load line. `bin/browser.mjs`: Chromium's launch, with its library folder.
- `journeys/*.mjs`: run by `$V journey <run> <name>` and by `pnpm test:journeys`.
