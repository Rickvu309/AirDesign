# What enforces each rule

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
| Every spec in `specs/` is replayed against the code by a test, or listed with a reason | `scripts/spec-replays.mjs`, the `spec-replays` step of `pnpm check`. It warns for now and blocks nothing |
| A spec property the code breaks today is kept in `<Module>.known.cfg` beside an `it.fails` test | `pnpm check:specs` fails when a known config stops failing |
| An edit changes only its PowerPoint parts and adds no validator error | `pnpm check:pptx` |
| Every lint rule has a test and is switched on | `scripts/bug-rule.mjs` |
| Rule code in `tooling/` stays under 10 percent of product code | `scripts/bug-rule.mjs` |
| A worktree whose work is on `main`, or whose branch is gone from GitHub, does not stay on the machine | `pnpm check` removes it with `scripts/worktrees.mjs` when it is clean and no process is using it. A worktree with no commits of its own, or on a detached commit, is removed only after 12 idle hours |
| A local branch with no worktree that holds nothing `main` lacks does not stay on the machine, and a clean main checkout follows `origin/main` | `pnpm check` deletes the branch and fast-forwards the checkout with `scripts/worktrees.mjs` |
| The branch of a pull request closed without merging does not stay on GitHub | the `closed-branch` workflow deletes it when the pull request closes. The pull request page can restore it. It leaves `main` and `archive/` branches alone |
| Run `pnpm check` after your last edit, before every push | `pnpm check` records the files it passed, and the `pre-push` hook that `pnpm install` sets up refuses any other commit |
| A commit whose test failed is not pushed; a failed test is load only when it passes alone | `pnpm check` stamps no commit with a failed `test`; `pnpm land` stamps after the alone rerun (`scripts/land-check.mjs`) |
| Titles and PR bodies follow the rules above; a PR names its areas | `pnpm land` refuses a bad title before the check and warns on a body with no `## Proof`; the `commit-titles` step warns; the `bar` check adds `long-title` and the area labels of `scripts/areas.json` |
| A PR is in the merge queue, not only believed to be | `pnpm land` reads the queue back and stops when the PR is neither queued nor armed (`scripts/merge-queue.mjs`) |
| A failed ci job is never rerun to pick up a fix that merged since | `pnpm land` has no rerun and prints whether `main` moved (`scripts/land-report.mjs`). A hand-run `gh run rerun` is caught only in review |
| A conflict with `main` is found before the check; no conflict marker is committed | `pnpm land` runs `git merge-tree` first and scans the commit before the push; the `conflict-markers` step of `pnpm check` scans it too. The step warns for now and blocks nothing |
| A pull request targets `main` | the `bar` check fails on any other base and prints `gh pr edit <number> --base main`; `pnpm land` refuses it before the push |
| A migration number is used once | the `migration-numbers` step of `pnpm check` compares the record with `origin/main` and names the next free number. It warns for now and blocks nothing; `pnpm land` stops on it |
| A dropped queue entry is seen | `pnpm land --watch` exits 1 with the queue run's failed tests when the queue drops the PR |
| The check lane's wait is said | `takeMachineLock` prints the place and expected wait, and logs runs to `~/.cache/airdesign/check-queue.jsonl` |
| A local browser run uses at most 4 workers | `playwright.config.ts` sets the count through `workerLimit` in `tests/browser-workers.ts`, and the `globalSetup` in `tests/browser/launch.ts` stops a larger `--workers` with one line unless `AIRDESIGN_BROWSER_WORKERS` is set. ci is left to Playwright's default |
| A test file sees only the rows it wrote | `postgresInfo` in `apps/api/src/harness.ts` gives each `apps/api` test file its own database, cloned from the template the globalSetup prepares, and `isolation.test.ts` fails when it sees another file's rows |
| A shipped migration is never edited; a change is a new migration | `apps/api/src/frozen-migrations.test.ts` checks each migration's exact sql against `apps/api/src/frozen-migrations.json`, and `scripts/frozen-migrations.mjs` only appends |
| Tests never retry | the Vitest and Playwright configs set no retries. A retry on one test is caught only in review |
| `main` takes only a commit that passed `ci` on top of the latest `main` | branch protection and the merge queue |
| A metric that moves away from its goal, and a changed PowerPoint case or deck that was already judged, is seen by the owner | the `bar` check labels the PR `lowers-the-bar`. It does not block |
| Planted faults on changed code are reported | the `mutation` job, which warns and blocks nothing |
| A PR that changes what a person sees has a Before / after section with an image from the `proof` release | the `bar` check labels the PR `needs-before-after` (`scripts/before-after.mjs`). It does not block. It reads paths only: a `.ts` file in `apps/web/src` outside `copy/`, `apps/web/public` and server words are missed |
| An agent's comment or review on a pull request or issue starts with the agent line | review |
| A change to what `ci` checks is seen by the owner | the `bar` check labels the PR `changes-ci`. It does not block |
| A bug you find and do not fix is an `it.fails` test. A skipped, todo, expected-failure or no-expect test counts as a known failure | `scripts/metrics.mjs` prints the count on every run. A known failure is shown, never blocked. A deleted test is caught only by the `mutation` job, which reports the planted faults that tests no longer catch |
| A new check starts in `warnSteps` in `scripts/check.mjs` and blocks only after it has caught a real fault with no false stop | review |
| Extend before you build a parallel version, reduced motion shows the finished state | review |
| Product copy follows `better-writing`, uses the words in `GLOSSARY.md`, and is true of what the product does | review |
| How agents work here | review |
| Every design screen and named state of the app shows no mechanical design fault: cut, covered or invisible text and controls, internal names, empty panels, stacked frames, low contrast | the `design-findings` step counts what the scanner finds in the browser tests into the `design-findings` metric. It warns for now and blocks nothing. Looking at the images is review |
