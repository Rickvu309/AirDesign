# AirDesign

AirDesign makes slide decks from an idea or a PowerPoint. A person and their AI agents edit a deck together, and it exports back to PowerPoint with no loss.

## What we never compromise

1. **No-loss PowerPoint.** Content nobody touched survives byte for byte. Microsoft's own validator judges every export against its original, and our own re-import never counts. Where that validator is blind, we add a check for the break it missed. An element with no native PowerPoint form yet, such as an AirDesign chart or diagram block, exports as a high-resolution picture of how it looks in AirDesign, at its place and size. Looking right in AirDesign comes before native export. No tool shows PowerPoint's repair prompt, so only a person who opened the file there can say it opens clean.
2. **The user's machine does the work.** Painting, import, export, capture and the agent loop run on the device. The server keeps the order of edits, storage, the Claude key and the MCP address.
3. **One path for agents.** A person's own agent over MCP and Aira get the same tools, permissions and limits.
4. **An edit paints before the network.**

Prefer the simple system. Keep only complexity the product needs.

## How a change lands

One agent builds, proves and lands its own change, and starts no review agent. A bug that gets through is fixed later, with a test or check that stops it coming back.

1. Branch from `origin/main` in a worktree of your own. One change is one PR against `main`.
2. Write the failing test first, at the lowest layer that fails. Tests never retry. A test that fails only under load has found a race: fix the race.
3. For anything a person sees or the API answers, drive the real app with the `verify-airdesign` skill and judge it as a design, with `look` and `compare` on each state you touched.
4. `pnpm gate` stamps the commit, and `git push` refuses a commit with no stamp. Never `--no-verify`.
5. `pnpm land --title "<title>" --body-file <file>` opens the PR, queues it and follows it to merged. The title is an imperative verb and the one outcome, in at most 72 characters. The body has the sections of `.github/pull_request_template.md`: write it with the `pr` skill (`~/.agents/skills/pr`), and keep the annotated `## Before / after` image from `verify-airdesign`. `pnpm land` refuses a bad title or body and says why.

`ci` on the PR, and again in the merge queue, is the judge. When it fails, fix the step it names and land again. Rebase only when GitHub reports a conflict. `main` deploys itself once `ci` passes.

Land finished work now as its own PR, since the queue keeps the order. To wait on a PR, call `watch_pull_request`. A thread that hands out work ends its turn, and the reports wake it.

## Where to look

- `COMMANDS.md` has each command's flags, limits and what every stage runs. Read it when a command refuses, waits or fails, before you change what `ci` runs, and before a deploy.
- `CHECKS.md` has each rule and the check that holds it. Read it before you add or change a rule or a check, and when a check fails. When a mistake repeats, give its rule a check and a row there.
- `GLOSSARY.md` has the one word for each idea. The words for checks and proof are in `check-words.md`, and overlay and blur are in `picture-fill.md`, and a slide transition is in `transition.md`, because `GLOSSARY.md` is already over the file-size limit. Use that word in the code, the test and the tool, so one search finds all three.

## Where code lives

- `apps/site` is the marketing and sign-in site.
- `apps/web` is the product UI, and every product screen goes here. A designed state is a page at `/screens/<id>-<name>`, registered in `src/<area>/<area>-screens.tsx`. Use shadcn parts, Sonner for toasts, and AI Elements for agent chat.
- `apps/api` is the server: deck order, storage, sign-in, OAuth grants and the MCP address, on Postgres.
- `packages/*` are shared. A package's `src/index.ts` is its whole interface, so read it first. Tests sit beside the code. `pnpm new:package <name>` creates one.
  - `document` decides what an edit does: order, undo, offline replay, deck limits. It imports no package.
  - `pptx` reads and writes PowerPoint files. It may import `document`.
  - `catalog` names every op, the HTTP routes, and the readers that check each request.
  - `engine` runs one op on an open deck.
  - `live` keeps the browser's copy of a deck in IndexedDB and syncs it with the server.
  - `mcp` is the agent side: the MCP server, tool calls, runs, turns, their limits and the eval tasks.
  - `render` paints slides in React: canvas, filmstrip, text editing.
  - `device` decides whether the user's open tab can take device work now.
  - `oauth` is the grant state machine.
  - `usage` is the Claude spend ledger and its allowance.
  - `fonts` names each font family and the files our server serves for it.
  - `theme` holds the tokens for color, type, space and motion.
- `specs/<topic>` holds a TLA+ spec for each state machine. A rule a person cares about is an invariant there.
- `tooling/` holds rules that constrain code. `scripts/` holds runners and generators.

## Ways to hurt yourself

1. **The demo markup.** `apps/site/src/landing/product-demo/editor-demo-art.html` is 84 KB and search tools skip it. Pass its path, search for a `data-demo-part` name, and read only that part.
2. **Production.** `studio.airdesign.app` serves `apps/web`, and its worker, `apps/web/worker/api-forward.ts`, forwards the API paths to the API origin. The MCP address is `https://studio.airdesign.app/mcp`. `mcp.airdesign.app` does not resolve.
3. **Screens and the app.** Pages under `/screens/` are static with sample data. The deck home (`src/decks/home.tsx`) and `src/thin-deck.tsx` call `apps/api` for real, and sign-in lives in `apps/site`.
4. **The shared stash.** Every worktree sees one `git stash` list, so keep work in progress as a commit on your branch. Touch only a stash entry you made.

## Rules

- Code has no comments. A better name does the explaining.
- Name a file or folder after what it contains, never `utils`, `helpers` or `common`.
- Extend what exists before building a parallel version.
- Agents write product copy with the `better-writing` skill at `~/.claude/skills/better-writing`. Copy says only what the product does today.
- Layout follows the tokens in `packages/theme` and the components in `apps/web/src/components/ui/`. Add a missing role to the token file.
- With reduced motion on, a page shows its finished state with no movement.
- Commit code and its tests. Plans, notes and scratch files stay out, and a merged PR is the record.
- A bug or a rule lands as a test, a check or a metric. A check is a free mechanical rule: no paid model, no model key, no waiting for a person.
- Decide a call that can be undone, do it, and report it. Ask the owner only for what the owner alone can do, or what cannot be undone.
- A comment or review on a pull request or issue starts with `🤖 **AI Agent responding on behalf of Quan Vu**`.
- Before changing an MCP tool or schema, read https://modelcontextprotocol.io/specification. Our own tool limits win where they differ.
