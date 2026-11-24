# AirDesign

AirDesign is an omakase deck design service. A person, or their AI agent, asks for a deck and gets a beautiful one, fast, without doing the design work.

## What we never compromise

1. **Omakase.** AirDesign makes the design choices, so the deck is good without the person asking. Fewer choices, each with impact.
2. **Polish before breadth.** Make the small things good before extending a feature. A simple thing done well beats a complex thing done roughly, in code and in design.
3. **The device does the work.** Painting, import, export and the agent loop run on the person's machine. That keeps AirDesign fast and the server small.
4. **One path for agents.** A person's own agent and Aira use the editor's tools. Anything a person can do, an agent can do the same way.
5. **An edit paints before the network.** The canvas answers at once, and saving follows.

PowerPoint is an import and an export, not the product. When they pull apart, the product wins and the PR names what the export loses.

## A note from Quan

Simple over complex. Ship nothing of low quality, in code or in design. Delete what the product does not need instead of keeping it alive, and do not build machinery to look impressive.

## Hit every surface

The common defect is a change that works where you tried it and is missing elsewhere. Before you call it done, say which of these it touched: canvas, design panel, filmstrip and capture, undo and offline replay, the agent tools and Aira, PowerPoint import and export.

## How it works

An edit, from a person or an agent, is read by `catalog` and applied by `doom` to the open deck's node tree. `render` paints it at once, then `live` sends it to `apps/api`, which orders everyone's edits as rows. `pptx` turns a PowerPoint file into a deck and back, on the device. `GLOSSARY.md` and the word files in `docs/words/` give one word per idea, for code, test and tool.

- `apps/web` is the product UI, with designed states at `/screens/<id>-<name>`. `apps/site` is marketing and sign-in. `apps/api` is the server, on Postgres.
- In `packages/`, `packages/<name>/src/index.ts` is a package's whole interface: `doom` (the core, imports no package), `document` (the slide model the painter still reads), `catalog`, `render`, `live`, `mcp`, `pptx`, plus `templates` (start decks), `theme` (tokens), `fonts`, `oauth`, `usage` (Claude spend).
- A folder with a `pack.yml` is a pack. `packwerk.yml` ranks packs in layers, and `pnpm check:boundaries` fails an import its pack does not allow. Read `pnpm exec ts-packwerk explain <folder>` before you change a pack. Tests are checked too: a test may import its own pack's private files, and `test_exempt` names the source-reading tests that stay unchecked. A `pack_todo.yml` lists known violations: fix them, never add to them. `todo_ceiling` is that list's size, and the check fails when it grows past `origin/main`.

## Land a change

1. Branch from `origin/main` in your own worktree. One change is one PR.
2. Write the failing test first, at the lowest layer that fails. Tests never retry: a failure only under load is a race.
3. For anything a person sees or the API answers, drive the real app with `verify-airdesign` and judge each touched state as a design.
4. `pnpm gate` stamps the commit. Never `--no-verify`.
5. `pnpm land --title "<imperative, at most 72 chars>" --body-file <file>` follows the PR to merged. Write the body with the `pr` skill. Fix a body later with `pnpm pr-body <number> <file>`, never `gh api`.

`ci` judges. `COMMANDS.md` explains every command, `pnpm rules` every checked rule, and `CHECKS.md` the rules review holds: read them when one fails.

## Ways to hurt yourself

1. Production is `studio.airdesign.app`, MCP at `/mcp`. `mcp.airdesign.app` does not resolve.
2. `/screens/` pages are sample data. The deck home and the editor at `src/editor/` call the API for real.
3. Every worktree shares one `git stash`. Keep work in progress as a commit.
4. Never kill processes you did not start, and never by name: agents share this machine. `verify-airdesign stop` touches only your own worktree's stacks.

## Taste

- No comments: a better name explains. Name a file after what it holds.
- Extend what exists before building a parallel version.
- Product copy uses the `better-writing` skill. Layout uses `packages/theme` tokens and `components/ui`. Reduced motion shows the finished state.
- A bug or repeated mistake lands as a test, check or metric. Plans and notes stay out of commits.
- Decide what can be undone and report it. Ask the owner only what only the owner can decide.
- Read the MCP specification before you change a tool. Our limits win.
