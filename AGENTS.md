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
- `pnpm check` prints the metrics, the numbers we want moved. Each has a goal, a floor or a limit in `metrics.json`. Pick one and move it. A PR does not write the test count or the known failure count: `test-count` only has to stay at or above its floor, and `known-failures` is measured on each run.
- `pnpm new:package <name>` creates a workspace package. Do not build one by hand.
- `pnpm dev` inside `apps/web` or `apps/site` starts that app.
- `pnpm run deploy` inside `apps/site` publishes the site. A commit on `main` that passed `ci` deploys the site to Cloudflare when it is still the tip of `main`, so `pnpm run deploy` by hand is for emergencies. It also deploys the API to Railway, and its pre-deploy step runs the database setup. `.railway/railway.ts` holds the Railway project's settings. Variables stay on Railway. After a change to that file merges, apply it with `railway config apply`.

`main` only accepts commits that passed the `ci` check, so every change goes through a PR. After opening one, run `gh pr merge --auto --rebase`. That puts the PR in the merge queue once its checks pass. The queue tests it on top of the latest `main`, together with the PRs ahead of it, and merges it with a rebase, which keeps commit authorship. Do not rebase a PR only because `main` moved. Rebase only when GitHub reports a conflict. The `ratchet` check fails a PR that lowers the bar: a raised limit, a moved goal, a removed metric, a metric moved away from its goal, a removed test file, or a changed PowerPoint case or deck the check already judges. Undo that part. The `check-regression` check covers the rules and scripts under `tooling/` and `scripts/` that have tests on `main`, and those tests themselves: it runs the tests `main` has against the PR's rules and scripts and fails a test that lost a line, so when one is `broken`, restore the behaviour or the line, or, when the check is meant to change, ask the owner to approve the PR and then rerun the check. `pnpm check` runs both locally, as its `ratchet` and `check-regression` steps, against where the branch left `origin/main`, so you see their verdict before you push. Locally they print what would block as a warning and pass, since only GitHub sees the owner's approval. A PR that changes what `ci` checks is labelled `changes-ci` for the owner to read and is not held. After it merges, `pnpm check` removes its local worktree and branch the next time it runs on this machine.

## Ways to hurt yourself

1. **Searching the demo markup.** `apps/site/src/landing/product-demo/editor-demo-art.html` is 84 KB, and search tools skip it. Pass its path and search for a `data-demo-part` name. Do not read it whole.
2. **Breaking old production.** `studio.` and `mcp.airdesign.app` still run the old backend. `apps/site/worker/old-deployment-passthrough.ts` forwards the paths it lists to it.
3. **Treating screens as a working app.** `apps/web` screens are static with sample data, and sign-in sends nothing. Nothing saves yet.

## Where code lives

- `apps/site` is the marketing and sign-in site. Color, type, space and motion live in `packages/theme`. Site classes stay in `src/site/site-theme.css`.
- `apps/web` is the product UI. Product screens go here, never in `apps/site`. Each designed state is a page at `/screens/<id>-<name>`, registered in `src/<area>/<area>-screens.tsx`. Use shadcn parts, Sonner for toasts, and AI Elements for agent chat.
- `packages/*` are shared packages. The build refuses a deep import, an undeclared dependency, or a browser or Node API in a pure package.
  - `packages/document` decides what an edit does: order, undo, offline replay and the deck limits. It imports no other package.
  - `packages/pptx` reads and writes PowerPoint files. It may import `document`.
  - `packages/theme` holds the tokens for color, type, space and motion.
- `specs/<topic>` holds a TLA+ spec for each state machine. A rule a person cares about is an invariant there.
- `tooling/` holds rules that constrain code. `scripts/` holds runners and generators.

## Rules

- Code has no comments. If code needs explaining, use a better name.
- Never name a file or folder `utils`, `helpers` or `common`. Name it after what it contains.
- Use one word per idea, everywhere. The same name appears in the code, the test and the tool, so one search finds all of it.
- Every package exposes only its `index.ts`, and tests sit beside the code. `@airdesign/theme` also exposes `tokens.css`.
- Extend what exists before building a parallel version.
- Copy follows the existing screens. Do not invent product copy. Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Test behavior that can break, at the lowest layer that fails. Tests never retry.
- Do not commit plans, research notes or scratch files. A merged PR is the record.

## How agents work here

- A bug or a rule lands in the repo as a test, a check or a metric. A chat message fixes nothing.
- A check is a free mechanical rule. No check calls a paid model, needs a model key in GitHub secrets, or waits for a person.
- Decide a call that can be undone, do it, and report it. Ask the owner only for what the owner alone can do, or what cannot be undone.
- A thread that hands out work never waits on another thread and never polls. It ends its turn, and the reports wake it.
- Before changing an MCP tool or schema, read the `mcp-builder` skill at `~/.agents/skills/mcp-builder`. Our own tool limits win where they differ.

## What enforces each rule

A rule with a check fails `pnpm check`, `pnpm check:pptx` or the merge. A rule marked review is a judgment call, and nothing fails when you skip it. When a mistake repeats, give its rule a check and move the row.

| Rule | Enforced by |
| --- | --- |
| No comments, no lint suppressions | lint: `no-comments` and the comment scan |
| No raw hex, sized arbitrary class or blanket transition | lint: `no-raw` |
| No file or folder named `utils`, `helpers` or `common` | lint: the name scan |
| A package exposes only its `index.ts`, declares what it imports, and stays pure | `pnpm check:boundaries` |
| No hand-kept list of what a folder holds: `pnpm typecheck` reads `apps/` and `packages/`, `pnpm test:tooling` reads `scripts/`, and the spec replay reads `specs/` | the `references` step of `pnpm check` fails when the root `tsconfig.json` lists references |
| Unit tests run with nothing built | `pnpm check` runs tests before typecheck |
| A state machine keeps its invariants | `pnpm check:specs` |
| An edit changes only its PowerPoint parts and adds no validator error | `pnpm check:pptx` |
| Every lint rule has a test and is switched on | `scripts/bug-rule.mjs` |
| Rule code in `tooling/` stays under 10 percent of product code | `scripts/bug-rule.mjs` |
| A worktree whose work is on `main`, or whose branch is gone from GitHub, does not stay on the machine | `pnpm check` removes it with `scripts/worktrees.mjs` when it is clean and no process is using it. A worktree with no commits of its own, or on a detached commit, is removed only after 12 idle hours |
| Run `pnpm check` after your last edit, before every push | `pnpm check` records the files it passed, and the `pre-push` hook that `pnpm install` sets up refuses any other commit |
| A test file sees only the rows it wrote | `postgresInfo` in `apps/api/src/harness.ts` gives each `apps/api` test file its own database, cloned from the template the globalSetup prepares, and `isolation.test.ts` fails when it sees another file's rows |
| Tests never retry | the Vitest and Playwright configs set no retries. A retry on one test is caught only in review |
| `main` takes only a commit that passed `ci` on top of the latest `main` | branch protection and the merge queue |
| A metric moves only toward its goal, a test file is not removed, and a PowerPoint case or deck already judged does not change | the `ratchet` check, run from `main`, and the `ratchet` step of a local `pnpm check` |
| A rule or script under `tooling/` or `scripts/` that has tests on `main` still passes those tests, as `main` has them, and those tests lose no line | the `check-regression` check, run from `main`, and the `check-regression` step of a local `pnpm check`. Only the owner's approval of the commit, and a rerun of the check after it, lets a broken one through |
| A change to what `ci` checks is seen by the owner | the `ratchet` check labels the PR `changes-ci`. It does not block |
| A bug you find and do not fix is an `it.fails` test. A skipped, todo, expected-failure or no-expect test counts as a known failure, and the number of tests cannot fall | `scripts/metrics.mjs` prints both counts on every run and fails when `test-count` is under its floor. A known failure is shown, never blocked. Tests deleted from a file that still exists are caught only in review until a per-file count exists |
| A new check starts in `warnSteps` in `scripts/check.mjs` and blocks only after it has caught a real fault with no false stop | review |
| One word per idea, extend before you build a parallel version, no invented copy, reduced motion shows the finished state | review |
| How agents work here | review |
