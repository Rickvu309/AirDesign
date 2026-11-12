# AirDesign verification map

This directory is the maintained source for verifying what an AirDesign user does. Read this index before driving the app, then use the matching feature file as the recipe. Driving commands are in `../SKILL.md`; below, `V` is `.agents/skills/verify-airdesign/bin/verify-airdesign.mjs`, run from the repo root.

## Every merge runs every journey

The `journeys` workflow (`.github/workflows/journeys.yml`) runs `pnpm test:journeys` on every push to `main`: it builds `apps/api` and `apps/web` once, launches one stack with `$V launch --no-build`, runs every journey in `journeys/` against it through `tests/journeys/journeys.spec.ts`, and stops the stack. A failure opens or comments on the issue `journey failed on main`, naming the journey, the commit and the run; the next passing push closes it. It does not run on pull requests and blocks no merge. Run the same thing locally with `pnpm test:journeys` from the repo root. A new journey file is driven in that suite once it is listed in `tests/journeys/journeys.spec.ts`. Journeys that call `kit.aira()` share the stack's one queue of recorded model streams, so they go in that file's `recorded Aira` group, which runs them one after another; every other journey runs in parallel.

## Baseline preconditions

- `$V launch` printed a run id and `$V doctor <run>` printed `"ok":true`.
- The run is yours. Never drive an instance another run or agent started.
- The database starts empty: no accounts, no decks. Each journey signs in a new account, so journeys do not depend on each other.
- Fixtures come from `scripts/pptx-fixtures/`. `clean.pptx` is one slide with one text box reading `Hello`.

## Driving conventions

- Start each journey from Home `/` as a signed-in person, the way a user arrives.
- Prefer roles and accessible names, then the app's data attributes (`data-slide-paint`, `data-canvas-element`, `data-slide-entry`), then `input[type=file]` and `[contenteditable="true"]`.
- Take every API path from `deckRoutes` or `signInRoutes`. Never type one.
- The app paints before the network. After a UI action, wait for the server copy with `expect.poll` on `deckRoutes.open` or `deckRoutes.list` before you call it saved.

## Proof and skip reporting

- Capture the action and the resulting state: a screenshot and ARIA snapshot after each step (`capture`), and the API answer that shows the stored result (`post`).
- Every feature that changes data proves it through a second view: the server copy, Home after a reload, or Trash.
- `proof.md` in the run's evidence dir records the commit, each step's note and the journey's result. Quote its path.
- When an entry point is not reachable in this stack, report it as not verified with the reason. Do not report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing what the user sees. It then has exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-airdesign`, `Gotchas`.

## Features

- [Open a PowerPoint or a blank deck and edit its text](./open-edit-save.md): import from Home or start a blank deck, type in the slide, the server keeps the text, reopening shows it. Journeys `open-edit-save`, `blank-deck`, `commit-once`, `element-index`.
- [Deck list and Trash](./deck-list-trash.md): Home's first visit, its decks, `No decks yet`, Move to Trash, Restore, Empty Trash. Journey `deck-list-trash`.
- [Move and resize an element](./move-resize.md): select an element, drag it, resize it from a corner, nudge it with the arrows; the server keeps the box and the export writes it. Journey `move-resize`.
- [Add a text box and delete an element](./element-edits.md): `Add text box` in the toolbar, Delete on a selected element. Journey `element-edits`.
- [Add a picture](./picture-add.md): `Add picture` in the toolbar, a dropped or pasted file, the upload and another device. Journey `picture-add`.
- [Add, duplicate, move and delete slides](./slide-commands.md): the slide list's `Add slide`, Ctrl/Cmd+D, Alt+arrows and Delete. Journeys `slide-commands`, `blank-slides`, `slide-layouts`.
- [Undo and redo the person's edits](./person-undo.md): the keys, the named toolbar buttons and `Unable to undo`. Journey `person-undo`.
- [Speaker notes](./speaker-notes.md): the notes bar under the slide, editable or locked, offline and through the export. Journey `speaker-notes`.
- [Slide paint](./slide-paint.md): the opened deck paints each element at its place on a slide of the right shape: text, pictures, shapes, tables, prompts, thumbnails. Journey `slide-paint`.
- [Reopen in a cleared browser](./cleared-browser.md): after IndexedDB, local storage and site files are cleared, the saved deck still shows its slide. Journey `cleared-browser`.
- [Delete account](./delete-account.md): the account menu deletes the account after the person types its email; the server, the stored originals and the browser keep nothing of it. Journey `delete-account`.
- [Ask Aira through the server](./aira-turn.md): one metered model call at a time streams text and tool calls, the tool calls run through `/mcp`, the person stops or undoes the run. Journey `aira-turn`.
- [Connected agents](./connected-agents.md): the account menu opens `/settings/agents`, shows and copies the MCP address, lists connected agents, and disconnects one so its access and refresh tokens stop working at once. Journey `connected-agents`.
- [Ask Aira in the Agent panel](./aira-panel.md): the person types to Aira in the open deck, watches the reply stream and the slide change, stops, retries or undoes the run, goes back to earlier chats, and reads the week's usage. Journeys `aira-panel`, `aira-head`, `aira-slides`.
- [Usage page](./usage-page.md): `/settings/usage` shows the week's Aira usage and when it resets. Journey `usage-page`.
- [Sign in](./sign-in.md): email, six-digit code, the designed mail, session cookie, signed-out redirect. Command `$V sign-in`, journeys `sign-in-mail` and `sign-in-pages` (the site pages on their own origin).
