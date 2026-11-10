# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Microsoft's own validator judges every export against its original. Our own re-import never counts. Where that validator is blind, we add a check for the break it missed. No tool shows PowerPoint's repair prompt, so we do not say a file opens clean in PowerPoint until a person has opened it there.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person connects their own agent over MCP or uses Aira. Both get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Do not keep complexity because it exists, or add machinery because it looks impressive. Fight scope creep.

## Commands

- `pnpm check` is the gate CI runs on every PR. Run it after your last edit, before every push. Never `--no-verify`. `pnpm check --all` keeps going and lists every failing step.
- `pnpm check:pptx` is the extra step CI runs when a PR touches `packages/pptx` or the PowerPoint check. It uses LibreOffice and poppler when the machine has both, or installs them into `~/.cache/pptx-tools` on first use. It needs the .NET 8 SDK.
- `pnpm check` prints the sticks, the numbers we want moved. Each has a goal or a limit in `sticks.json`. Pick one and move it.
- `pnpm new:package <name>` creates a workspace package. Do not build one by hand.
- `pnpm dev` inside `apps/web` or `apps/site` starts that app.
- `pnpm run deploy` inside `apps/site` publishes the site. Merging to `main` deploys nothing.

`main` only accepts commits that passed the `gate` check, so every change goes through a PR. After opening one, run `gh pr merge --auto --rebase`. It merges when `gate` passes, and rebase keeps commit authorship. `main` only merges a PR that contains the latest `main`, so when yours falls behind, run `gh pr update-branch --rebase`. The `owner gate` check fails a PR that lowers the bar: a raised limit, a moved goal, a removed stick, a stick moved away from its goal, or a changed PowerPoint case or deck the check already judges. Undo that part. A PR that changes what the gate checks is labelled `touched the bar` for the owner to read and is not held. After it merges, remove its local worktree and branch if nothing else uses them.

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

## What enforces each rule

A rule with a check fails `pnpm check`, `pnpm check:pptx` or the merge. A rule marked review is a judgment call, and nothing fails when you skip it. When a mistake repeats, give its rule a check and move the row.

| Rule | Enforced by |
| --- | --- |
| No comments, no lint suppressions | lint: `no-comments` and the comment scan |
| No raw hex, sized arbitrary class or blanket transition | lint: `no-raw` |
| No file or folder named `utils`, `helpers` or `common` | lint: the name scan |
| A package exposes only its `index.ts`, declares what it imports, and stays pure | `pnpm check:boundaries` |
| Unit tests run with nothing built | `pnpm check` runs tests before typecheck |
| A state machine keeps its invariants | `pnpm check:specs` |
| An edit changes only its PowerPoint parts and adds no validator error | `pnpm check:pptx` |
| Every lint rule has a test and is switched on | `scripts/bug-rule.mjs` |
| Rule code in `tooling/` stays under 10 percent of product code | `scripts/bug-rule.mjs` |
| Tests never retry | the Vitest and Playwright configs set no retries. A retry on one test is caught only in review |
| `main` takes only a gated commit that contains the latest `main` | branch protection |
| A stick moves only toward its goal, and a PowerPoint case or deck already judged does not change | the `owner gate` check, run from `main` |
| A change to what the gate checks is seen by the owner | the `owner gate` check labels the PR `touched the bar`. It does not block |
| A bug you find and do not fix is an `it.fails` test. A skipped, todo, expected-failure or no-expect test counts as a known fault, and the number of tests cannot fall | `scripts/sticks.mjs`: both counts must match `sticks.json` |
| One word per idea, extend before you build a parallel version, no invented copy, reduced motion shows the finished state | review |
