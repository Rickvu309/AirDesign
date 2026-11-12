# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Microsoft's own validator judges every export against its original. Our own re-import never counts. Where that validator is blind, we add a check for the break it missed. No tool shows PowerPoint's repair prompt, so we do not say a file opens clean in PowerPoint until a person has opened it there.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person connects their own agent over MCP or uses Aira. Both get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Do not keep complexity because it exists, or add machinery because it looks impressive. Fight scope creep.

## Commands

- `ci` runs `pnpm check` on every PR. Run it after your last edit, before every push. `git push` refuses a commit whose files no `pnpm check` saw pass. Only `test` and `browser` may fail locally and still allow the push, because they depend on machine load and `ci` judges them. Never `--no-verify`. `pnpm check --all` keeps going and lists every failing step. On your machine it skips the browser tests, which `ci` runs. Run them yourself with `pnpm test:browser`. On your machine one check runs at a time: a second `pnpm check` or `pnpm check:pptx` waits for the first, in any worktree, so a busy machine does not time tests out. A test that fails only under load is not a reason to change the test.
- `pnpm check:pptx` is the extra step CI runs when a PR touches `packages/pptx` or the PowerPoint check. It uses LibreOffice and poppler when the machine has both, or installs them into `~/.cache/pptx-tools` on first use. It needs the .NET 8 SDK.
- `pnpm check` prints the metrics, the numbers we want moved. Each has a goal or a limit in `metrics.json`. Pick one and move it. A PR does not write the known failure count: `known-failures` is measured on each run.
- `pnpm new:package <name>` creates a workspace package. Do not build one by hand.
- `pnpm dev` inside `apps/web` or `apps/site` starts that app.
- `pnpm run deploy` inside `apps/site` or `apps/web` builds that app and publishes it to Cloudflare with `wrangler deploy`. It does not deploy the API. A commit on `main` that passed `ci` deploys both the same way when it is still the tip of `main`, in `.github/workflows/deploy.yml`. Each app deploys on its own, so one red deploy does not stop the other. So `pnpm run deploy` by hand is for emergencies. Railway builds the API from GitHub `main` and deploys it, and runs the database setup before each deploy. `.railway/railway.ts` holds the Railway project's settings. Variables stay on Railway. After a change to that file merges, apply it with `railway config apply`.

`main` only accepts commits that passed the `ci` check, so every change goes through a PR. After opening one, run `gh pr merge --auto --rebase`. That puts the PR in the merge queue once its checks pass. The queue tests it on top of the latest `main`, together with the PRs ahead of it, and merges it with a rebase, which keeps commit authorship. Do not rebase a PR only because `main` moved. Rebase only when GitHub reports a conflict. The `bar` check never stops a PR. It lists what the PR lowers: a raised limit, a moved goal, a removed metric, a metric moved away from its goal, or a changed PowerPoint case or deck the check already judges. It labels that PR `lowers-the-bar`, and it labels a PR that changes what `ci` checks `changes-ci`. The owner reads both labels after the merge. `pnpm check` prints the same list locally, as its `bar` step, against where the branch left `origin/main`. When your PR is on that list and you did not mean it, undo that part. After it merges, `pnpm check` removes its local worktree and branch the next time it runs on this machine.

## Ways to hurt yourself

1. **Searching the demo markup.** `apps/site/src/landing/product-demo/editor-demo-art.html` is 84 KB, and search tools skip it. Pass its path and search for a `data-demo-part` name. Do not read it whole.
2. **Breaking production.** `studio.airdesign.app` serves `apps/web`, and its worker, `apps/web/worker/api-forward.ts`, forwards the API paths to the API origin. The MCP address is `https://studio.airdesign.app/mcp`. `mcp.airdesign.app` does not resolve. The site answers its retired paths with its own 404 and forwards nothing.
3. **Mixing up screens and the app.** Pages under `/screens/` are static with sample data. The deck home (`src/decks/home.tsx`) and `src/thin-deck.tsx` call `apps/api` for real, and sign-in lives in `apps/site`.

## Where code lives

- `apps/site` is the marketing and sign-in site. Color, type, space and motion live in `packages/theme`. Site classes stay in `src/site/site-theme.css`.
- `apps/web` is the product UI. Product screens go here, never in `apps/site`. Each designed state is a page at `/screens/<id>-<name>`, registered in `src/<area>/<area>-screens.tsx`. Use shadcn parts, Sonner for toasts, and AI Elements for agent chat.
- `apps/api` is the server: deck order, storage, sign-in, OAuth grants and the MCP address, on Postgres.
- `packages/*` are shared packages. Each one's `src/index.ts` is its whole interface, so read that first. The build refuses a deep import, an undeclared dependency, or a browser or Node API in a pure package.
  - `packages/document` decides what an edit does: order, undo, offline replay and the deck limits. It imports no other package.
  - `packages/pptx` reads and writes PowerPoint files. It may import `document`.
  - `packages/catalog` names every op a person or agent can call, the HTTP routes, and the readers that check each request.
  - `packages/engine` runs one op on an open deck: `call(op, deck, caller, raw)`.
  - `packages/live` keeps the browser's copy of a deck in IndexedDB and syncs it with the server.
  - `packages/mcp` is the agent side: the MCP server, tool calls, runs, turns and their limits, and the eval tasks.
  - `packages/render` paints slides in React: canvas, filmstrip and text editing.
  - `packages/device` decides whether the user's open tab can take device work now.
  - `packages/oauth` is the grant state machine: exchange, call, rotate, revoke.
  - `packages/usage` is the Claude spend ledger and its allowance.
  - `packages/theme` holds the tokens for color, type, space and motion.
- `specs/<topic>` holds a TLA+ spec for each state machine. A rule a person cares about is an invariant there.
- `tooling/` holds rules that constrain code. `scripts/` holds runners and generators.

## Rules

- Code has no comments. If code needs explaining, use a better name.
- Never name a file or folder `utils`, `helpers` or `common`. Name it after what it contains.
- Use one word per idea, everywhere. The same name appears in the code, the test and the tool, so one search finds all of it. `GLOSSARY.md` says which word.
- Every package exposes only its `index.ts`, and tests sit beside the code. `@airdesign/theme` also exposes `tokens.css`.
- Extend what exists before building a parallel version.
- Copy follows the existing screens. Do not invent product copy. Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Test behavior that can break, at the lowest layer that fails. Tests never retry.
- Do not commit plans, research notes or scratch files. A merged PR is the record.

## How agents work here

- One agent builds, tests and proves its own change, then queues the PR. No review or verifier agent reads it, and no agent starts one. A bug that gets through is fixed later, together with a test or check that keeps it from coming back.
- Prove the change before you push. Write the failing test first, then run `pnpm check`. For anything a user sees or the API answers, also drive the real app with the `verify-airdesign` skill in `.agents/skills/verify-airdesign`. The PR body says what you ran and what you saw.
- For a change a person sees, look at it as a design: run `look` and `compare` from `verify-airdesign` on each state it touches, open the images, say what you see, and put the image paths and the finding counts before and after in the PR body.
- A bug or a rule lands in the repo as a test, a check or a metric. A chat message fixes nothing.
- A check is a free mechanical rule. No check calls a paid model, needs a model key in GitHub secrets, or waits for a person.
- Decide a call that can be undone, do it, and report it. Ask the owner only for what the owner alone can do, or what cannot be undone.
- A thread that hands out work never waits on another thread and never polls. It ends its turn, and the reports wake it.
- Never hold finished work until another PR merges. Open it as its own PR now, since the queue keeps the order, or call `watch_pull_request` on the PR you wait on so its merge wakes you.
- Before changing an MCP tool or schema, read the MCP specification at https://modelcontextprotocol.io/specification. Our own tool limits win where they differ.

## What enforces each rule

A rule with a check fails `pnpm check`, `pnpm check:pptx` or the merge. A rule marked review is a judgment call, and nothing fails when you skip it. When a mistake repeats, give its rule a check and move the row.

| Rule | Enforced by |
| --- | --- |
| No comments, no lint suppressions | lint: `no-comments` and the comment scan |
| No raw hex, sized arbitrary class or blanket transition | lint: `no-raw` |
| No file or folder named `utils`, `helpers` or `common` | lint: the name scan |
| One word per idea: a word listed in `tooling/oxlint-plugin-airdesign/glossary.json` is replaced by the word it names | lint: the name scan reads the glossary. A line kept on purpose is listed there with a reason. It warns for now and blocks nothing |
| Product code takes the clock, random ids and temp folders as options: no read of `Date.now`, `Date()`, `new Date()`, `performance.now`, `Temporal.Now`, `Math.random`, `crypto.randomUUID`, `crypto.getRandomValues`, `tmpdir` or `TMPDIR`, except as the `??` or default-parameter fallback of an option | lint: `no-hidden-input`. It warns for now and blocks nothing |
| Only `packages/document` makes an `ElementId`: no type assertion to `ElementId` outside `packages/document/src` | lint: `no-element-id-cast`. It warns for now and blocks nothing |
| A package exposes only its `index.ts`, declares what it imports, and stays pure | `pnpm check:boundaries` |
| A package's `index.ts` exports only names a caller outside the package, or a test through `index.ts`, uses | `scripts/interface-width.mjs`, the `interface-width` step of `pnpm check`. It warns for now and blocks nothing |
| A file an agent writes that is over 5,000 tokens does not grow, and no new file starts over it. A token is four bytes | `scripts/file-size.mjs`, the `file-size` step of `pnpm check`. Its message says how to split the file |
| No hand-kept list of what a folder holds: `pnpm typecheck` reads `apps/` and `packages/`, `pnpm test:tooling` reads `scripts/`, and the spec replay reads `specs/` | the `references` step of `pnpm check` fails when the root `tsconfig.json` lists references |
| Unit tests run with nothing built | `pnpm check` runs tests before typecheck |
| A state machine keeps its invariants | `pnpm check:specs` |
| An edit changes only its PowerPoint parts and adds no validator error | `pnpm check:pptx` |
| Every lint rule has a test and is switched on | `scripts/bug-rule.mjs` |
| Rule code in `tooling/` stays under 10 percent of product code | `scripts/bug-rule.mjs` |
| A worktree whose work is on `main`, or whose branch is gone from GitHub, does not stay on the machine | `pnpm check` removes it with `scripts/worktrees.mjs` when it is clean and no process is using it. A worktree with no commits of its own, or on a detached commit, is removed only after 12 idle hours |
| A local branch with no worktree that holds nothing `main` lacks does not stay on the machine, and a clean main checkout follows `origin/main` | `pnpm check` deletes the branch and fast-forwards the checkout with `scripts/worktrees.mjs` |
| The branch of a pull request closed without merging does not stay on GitHub | the `closed-branch` workflow deletes it when the pull request closes. The pull request page can restore it. It leaves `main` and `archive/` branches alone |
| Run `pnpm check` after your last edit, before every push | `pnpm check` records the files it passed, and the `pre-push` hook that `pnpm install` sets up refuses any other commit |
| A test file sees only the rows it wrote | `postgresInfo` in `apps/api/src/harness.ts` gives each `apps/api` test file its own database, cloned from the template the globalSetup prepares, and `isolation.test.ts` fails when it sees another file's rows |
| A shipped migration is never edited; a change is a new migration | `apps/api/src/frozen-migrations.test.ts` checks each migration's exact sql against `apps/api/src/frozen-migrations.json`, and `scripts/frozen-migrations.mjs` only appends |
| Tests never retry | the Vitest and Playwright configs set no retries. A retry on one test is caught only in review |
| `main` takes only a commit that passed `ci` on top of the latest `main` | branch protection and the merge queue |
| A metric that moves away from its goal, and a changed PowerPoint case or deck that was already judged, is seen by the owner | the `bar` check labels the PR `lowers-the-bar`. It does not block |
| Planted faults on changed code are reported | the `mutation` job, which warns and blocks nothing |
| A change to what `ci` checks is seen by the owner | the `bar` check labels the PR `changes-ci`. It does not block |
| A bug you find and do not fix is an `it.fails` test. A skipped, todo, expected-failure or no-expect test counts as a known failure | `scripts/metrics.mjs` prints the count on every run. A known failure is shown, never blocked. A deleted test is caught only by the `mutation` job, which reports the planted faults that tests no longer catch |
| A new check starts in `warnSteps` in `scripts/check.mjs` and blocks only after it has caught a real fault with no false stop | review |
| Extend before you build a parallel version, no invented copy, reduced motion shows the finished state | review |
| How agents work here | review |
| Every design screen and named state of the app shows no mechanical design fault: cut, covered or invisible text and controls, internal names, empty panels, stacked frames, low contrast | the `design-findings` step counts what the scanner finds in the browser tests into the `design-findings` metric. It warns for now and blocks nothing. Looking at the images is review |
