# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Microsoft's own validator judges every export against its original. Our own re-import never counts. Where that validator is blind, we add a check for the break it missed. No tool shows PowerPoint's repair prompt, so we do not say a file opens clean in PowerPoint until a person has opened it there.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person connects their own agent over MCP or uses Aira. Both get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Do not keep complexity because it exists, or add machinery because it looks impressive. Fight scope creep.

## Commands

- `ci` runs `pnpm check` on every PR. Run it after your last edit, before every push. `git push` refuses a commit whose files no `pnpm check` saw pass, and `pnpm check` stamps a commit only when nothing failed or only `browser` did, because the browser tests depend on machine load and `ci` judges them. A failed `test` stamps nothing; `pnpm land --check` stamps the commit once every failed file passes alone. Never `--no-verify`. `pnpm check --all` keeps going and lists every failing step. On your machine it skips the browser tests, which `ci` runs. Run them yourself with `pnpm test:browser`. A local browser run uses at most 4 workers, fewer on a small machine, and refuses a `--workers` above that unless the owner sets `AIRDESIGN_BROWSER_WORKERS`. On your machine one check runs per 16 cores and 12 GB of memory, at least one, and `AIRDESIGN_CHECK_SLOTS` sets another count. A slot past the first opens only while the load average is below the core count. Once no slot is open, the next `pnpm check`, `check:pptx` or `suites --run` prints its place in line and waits. A test file that `pnpm land` reruns alone takes the small lane instead, which runs beside a full check, one job at a time, niced and on two workers. A test that fails only under load is not a reason to change the test.
- `pnpm land` is how a change reaches `main`. Run it in the branch's worktree after your last edit. It checks the base is `main` and the title, tries the merge with `origin/main` and the migration numbers before the check, runs `pnpm check`, scans the commit for conflict markers, pushes with a lease, opens the PR against `main` when you give `--title` and `--body-file`, or sets an open PR's title, body and base from them, since `gh pr edit` fails on this repo, waits for ci to start on the head, queues it, reads the merge queue back, and follows ci to merged. When only `test` failed, it reruns each failed test file alone, once, and goes on only if every file passes alone. That tells machine load from a real fault; it is not a retry, and tests still never retry. It never reruns a ci job, because a rerun tests the same snapshot of `main`: when ci fails it prints the failed tests, the kept `test-results` artifact, and whether `main` moved or changed a failing test file, so you know when to rebase. An unknown flag stops it before anything runs. `--status` prints where a PR stands and why the queue last dropped it, and changes nothing. `--watch` follows a queued PR and exits 1 with the failed tests when ci fails or the queue drops it. `--check` stops after the stamp. `--pr <number>` names a PR from any directory. Before the check it also stops a branch that puts files back to content `main` has since replaced, which is what a squash or `git reset --soft` made from a stale tree does; a deliberate revert names each file in a `Reverts: <path>` line of the commit body.
- `pnpm check:pptx` is the extra step CI runs when a PR touches `packages/pptx` or the PowerPoint check. It uses LibreOffice and poppler when the machine has both, or installs them into `~/.cache/pptx-tools` on first use. It needs the .NET 8 SDK.
- `pnpm check` prints the metrics, the numbers we want moved. Each has a goal or a limit in `metrics.json`. Pick one and move it. A PR does not write `known-failures` or `long-titles`: they are measured on each run.
- `pnpm new:package <name>` creates a workspace package. Do not build one by hand.
- `pnpm dev` inside `apps/web` or `apps/site` starts that app.
- `pnpm run deploy` inside `apps/site` or `apps/web` builds that app and publishes it to Cloudflare with `wrangler deploy`. It does not deploy the API. A commit on `main` that passed `ci` deploys both the same way when it is still the tip of `main`, in `.github/workflows/deploy.yml`. Each app deploys on its own, so one red deploy does not stop the other. So `pnpm run deploy` by hand is for emergencies. Railway builds the API from GitHub `main` and deploys every commit without waiting for checks, because it skips a commit when any workflow on it fails, and runs the database setup before each deploy. `.railway/railway.ts` holds the Railway project's settings. Variables stay on Railway. After a change to that file merges, apply it with `railway config apply`.

`main` only accepts commits that passed the `ci` check, so every change goes through a PR against `main`, never against another PR's branch. The PR enters the queue once its checks pass. The queue tests it on top of the latest `main`, together with the PRs ahead of it, and merges it with a rebase, which keeps commit authorship. Do not rebase a PR only because `main` moved. Rebase only when GitHub reports a conflict. The `bar` check never stops a PR. It lists what the PR lowers: a raised limit, a moved goal, a removed metric, a metric moved away from its goal, or a changed PowerPoint case or deck the check already judges. It labels that PR `lowers-the-bar`, and it labels a PR that changes what `ci` checks `changes-ci`. The owner reads both labels after the merge. `pnpm check` prints the same list locally, as its `bar` step, against where the branch left `origin/main`. When your PR is on that list and you did not mean it, undo that part.

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
- Agents write product copy. It follows the `better-writing` skill, which lives only on the owner's machine at `~/.claude/skills/better-writing`. It reuses the product's words, recorded in `GLOSSARY.md`, and says only what the product does today. Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Test behavior that can break, at the lowest layer that fails. Tests never retry.
- Do not commit plans, research notes or scratch files. A merged PR is the record.
- A PR or commit title is one line of at most 72 characters: an imperative verb, then the one outcome. No full stop at the end, no list of everything inside, no `fix:` or WIP prefix, no PR number. The rest goes in the body, after a blank line in a commit.
- A PR body has the sections of `.github/pull_request_template.md`, in its order, each only when it applies: `## What changes`, `## Proof`, `## Before / after`, `## Not done`.

## How agents work here

- One agent builds, tests and proves its own change, then queues the PR. No review or verifier agent reads it, and no agent starts one. A bug that gets through is fixed later, together with a test or check that keeps it from coming back.
- Prove the change before you push. Write the failing test first, then run `pnpm check`. For anything a user sees or the API answers, also drive the real app with the `verify-airdesign` skill.
- A PR that changes what a person sees carries a `## Before / after` section made with `verify-airdesign before-after` and `publish`: one annotated image and a `| main | this PR |` table, linked from the `proof` release.
- An agent's comment or review on a pull request or issue starts with `🤖 **AI Agent responding on behalf of Quan Vu**`.
- For a change a person sees, look at it as a design: run `look` and `compare` from `verify-airdesign` on each state it touches, open the images, say what you see, and put the image paths and the finding counts before and after in the PR body.
- A bug or a rule lands in the repo as a test, a check or a metric. A chat message fixes nothing.
- A check is a free mechanical rule. No check calls a paid model, needs a model key in GitHub secrets, or waits for a person.
- Decide a call that can be undone, do it, and report it. Ask the owner only for what the owner alone can do, or what cannot be undone.
- A thread that hands out work never waits on another thread and never polls. It ends its turn, and the reports wake it.
- Never hold finished work until another PR merges. Open it as its own PR now, since the queue keeps the order, or call `watch_pull_request` on the PR you wait on so its merge wakes you.
- Before changing an MCP tool or schema, read the MCP specification at https://modelcontextprotocol.io/specification. Our own tool limits win where they differ.

## What enforces each rule

`CHECKS.md` lists each rule above and the check, hook or review that holds it. Read it before you add or change a rule or a check, and when a check fails and you want to know what it guards. When a mistake repeats, give its rule a check and move its row there.
