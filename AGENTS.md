# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Microsoft's own validator judges every export against its original. Our own re-import never counts. Where that validator is blind, we add a check for the break it missed. An element with no native PowerPoint form yet, such as an AirDesign chart or diagram block, exports as a high-resolution picture of how it looks in AirDesign, at its place and size. Looking right in AirDesign comes before native export. No tool shows PowerPoint's repair prompt, so a file opens clean in PowerPoint only once a person has opened it there.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person connects their own agent over MCP or uses Aira. Both get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Keep only complexity the product needs.

## How a change lands

One agent builds, proves and lands its own change. No review or verifier agent reads it, and no agent starts one. A bug that gets through is fixed later, with a test or check that keeps it from coming back.

1. Branch from `origin/main` in a worktree of your own. Every change is one PR against `main`, never against another PR's branch.
2. Write the failing test first, at the lowest layer that fails. Tests never retry. A test that fails only under load has found a race: fix the race and keep the test.
3. For anything a person sees or the API answers, drive the real app with the `verify-airdesign` skill and judge it as a design: run `look` and `compare` on each state you touched, open the images, say what you see.
4. `pnpm gate` runs the cheap checks and the tests your diff reaches, then stamps the commit. `git push` refuses a commit with no stamp. Never `--no-verify`.
5. `pnpm land --title "<title>" --body-file <file>` pushes, opens the PR, queues it and follows it to merged. Land finished work now as its own PR, since the queue keeps the order. To wait on another PR, call `watch_pull_request`.

`ci` runs on the PR and again in the merge queue, and it is the judge. When it fails, `pnpm land` prints the failed tests: fix them and land again. Rebase only when GitHub reports a conflict. A commit on `main` that passed `ci` deploys itself, so `pnpm run deploy` by hand is for emergencies.

`COMMANDS.md` holds each command's flags, limits and what every stage runs. Read it when a command refuses, waits or fails, before you change what `ci` runs, and before a deploy.

## What a PR carries

- **Title**, for a commit too: one line of at most 72 characters, an imperative verb and then the one outcome. No full stop at the end, no list of everything inside, no `fix:` or WIP prefix, no PR number. The rest goes in the body.
- **Body:** the sections of `.github/pull_request_template.md`, in its order, each only when it applies: `## What changes`, `## Proof`, `## Before / after`, `## Not done`.
- **A change a person sees:** `## Before / after` comes from `verify-airdesign before-after` and `publish`: one annotated image and a `| main | this PR |` table, linked from the `proof`, `proof-2`, … releases, with the finding counts before and after. A local path opens on no other machine. When nothing looks different, the section is the one line `No visible change: <why>`.
- **A comment or review** on a pull request or issue starts with `🤖 **AI Agent responding on behalf of Quan Vu**`.

## Ways to hurt yourself

1. **Searching the demo markup.** `apps/site/src/landing/product-demo/editor-demo-art.html` is 84 KB, and search tools skip it. Pass its path and search for a `data-demo-part` name. Read only the part you found.
2. **Breaking production.** `studio.airdesign.app` serves `apps/web`, and its worker, `apps/web/worker/api-forward.ts`, forwards the API paths to the API origin. The MCP address is `https://studio.airdesign.app/mcp`. `mcp.airdesign.app` does not resolve. The site answers its retired paths with its own 404 and forwards nothing.
3. **Mixing up screens and the app.** Pages under `/screens/` are static with sample data. The deck home (`src/decks/home.tsx`) and `src/thin-deck.tsx` call `apps/api` for real, and sign-in lives in `apps/site`.
4. **The stash is shared.** Every worktree sees one `git stash` list, so keep work in progress as a commit on your branch. If you must stash, name your source with `git stash push -m "<absolute worktree path>"`, and read the message and hash before you recover your entry. Touch only an entry you made.

## Where code lives

- `apps/site` is the marketing and sign-in site. Site classes stay in `src/site/site-theme.css`.
- `apps/web` is the product UI, and every product screen goes here. Each designed state is a page at `/screens/<id>-<name>`, registered in `src/<area>/<area>-screens.tsx`. Use shadcn parts, Sonner for toasts, and AI Elements for agent chat.
- `apps/api` is the server: deck order, storage, sign-in, OAuth grants and the MCP address, on Postgres.
- `packages/*` are shared. A package's `src/index.ts` is its whole interface, so read that first. Tests sit beside the code. The build refuses a deep import, an undeclared dependency, or a browser or Node API in a pure package. `pnpm new:package <name>` creates one.
  - `document` decides what an edit does: order, undo, offline replay and the deck limits. It imports no other package.
  - `pptx` reads and writes PowerPoint files. It may import `document`.
  - `catalog` names every op a person or agent can call, the HTTP routes, and the readers that check each request.
  - `engine` runs one op on an open deck: `call(op, deck, caller, raw)`.
  - `live` keeps the browser's copy of a deck in IndexedDB and syncs it with the server.
  - `mcp` is the agent side: the MCP server, tool calls, runs, turns and their limits, and the eval tasks.
  - `render` paints slides in React: canvas, filmstrip and text editing.
  - `device` decides whether the user's open tab can take device work now.
  - `oauth` is the grant state machine: exchange, call, rotate, revoke.
  - `usage` is the Claude spend ledger and its allowance.
  - `fonts` names each font family and the files our server serves for it.
  - `theme` holds the tokens for color, type, space and motion, and also exposes `tokens.css`.
- `specs/<topic>` holds a TLA+ spec for each state machine. A rule a person cares about is an invariant there.
- `tooling/` holds rules that constrain code. `scripts/` holds runners and generators.

## Rules

- Code has no comments. A better name does the explaining.
- Name a file or folder after what it contains, never `utils`, `helpers` or `common`.
- Use one word per idea, everywhere, so one search finds the code, the test and the tool. `GLOSSARY.md` says which word.
- Extend what exists before building a parallel version.
- Agents write product copy with the `better-writing` skill, which lives only on the owner's machine at `~/.claude/skills/better-writing`. Copy reuses the product's words from `GLOSSARY.md` and says only what the product does today.
- Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Commit code and its tests only. Plans, research notes and scratch files stay out: a merged PR is the record.
- A bug or a rule lands in the repo as a test, a check or a metric. A chat message fixes nothing.
- A check is a free mechanical rule. It calls no paid model, needs no model key in GitHub secrets, and waits for no person.
- Decide a call that can be undone, do it, and report it. Ask the owner only for what the owner alone can do, or what cannot be undone.
- A thread that hands out work ends its turn, and the reports wake it. It never waits on another thread or polls.
- Before changing an MCP tool or schema, read the MCP specification at https://modelcontextprotocol.io/specification. Our own tool limits win where they differ.

## What enforces each rule

`CHECKS.md` lists each rule above and the check, hook or review that holds it. Read it before you add or change a rule or a check, and when a check fails and you want to know what it guards. When a mistake repeats, give its rule a check and move its row there.
