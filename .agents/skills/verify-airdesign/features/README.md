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

## Scratch journeys

A seam no shipped journey covers is driven with a scratch journey run by its path, `$V journey <run> ~/tmp/<name>.mjs`, which takes `expect` from the kit. Its evidence lands under the run like a shipped journey's. When a scratch journey finds a fault, pin it as a `test.fail` in the nearest browser spec and name the spec in the feature file; when it proves a behaviour, write what it drove and saw in the feature file with its date.

## Proof and skip reporting

- Capture the action and the resulting state: a screenshot and ARIA snapshot after each step (`capture`), and the API answer that shows the stored result (`post`).
- Every feature that changes data proves it through a second view: the server copy, Home after a reload, or Trash.
- `proof.md` in the run's evidence dir records the commit, each step's note and the journey's result. Quote its path.
- When an entry point is not reachable in this stack, report it as not verified with the reason. Do not report it as verified through another path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing what the user sees. It then has exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify-airdesign`, `Gotchas`.

## Features

- [Open a PowerPoint or a blank deck and edit its text](./open-edit-save.md): import from Home or start a blank deck, type in the slide, make it bold, italic or underlined, the server keeps the text, reopening shows it. Journeys `open-edit-save`, `blank-deck`, `commit-once`, `element-index`.
- [Deck list and Trash](./deck-list-trash.md): Recents' six newest decks, `No decks yet`, a deck left before its editor opened, Move to Trash, Restore, Empty Trash, starring a deck and the sidebar's Starred list. Journeys `deck-list-trash`, `deck-grid-motion` and `deck-stars`.
- [Deck names, search and All decks](./deck-names.md): `All decks`, the sidebar search, renaming from the editor title, a name queued on the device and sent from Home, the exported file's name and its toast, the disabled Design tab. Journey `deck-names`.
- [Keep typed text and paint from the device](./keep-typed-text.md): the keystroke journal through a reload or a closed tab, a lost commit answer, the device copy kept per account and painting before the server answers, a refused deck closing. Journey `typed-reload`.
- [Move and resize an element](./move-resize.md): select an element, drag it, resize it from a corner, nudge it with the arrows; the server keeps the box and the export writes it. Journey `move-resize`.
- [Add a text box and delete an element](./element-edits.md): `Add text box` in the toolbar, Delete on a selected element, their undo and what a screen reader hears. Journey `element-edits`.
- [Add a picture](./picture-add.md): `Add picture` in the toolbar, a dropped or pasted file, its undo, the upload and another device. Journey `picture-add`.
- [Insert a shape](./shape-insert.md): `Shapes` in the toolbar, a line, a rectangle or an ellipse in the theme's style, moved, resized, deleted, undone and exported. Journey `shape-insert`.
- [Bring an element forward or send it backward](./element-order.md): the menu on a selected element, the four stacking actions, their shortcuts, and an export that changes only that slide. Journey `element-order`.
- [Group and ungroup elements](./group-elements.md): Shift+click, Group and Ungroup in the element's menu and their shortcuts, moving a group, Undo, the export, and an agent's group. Journey `group-elements`.
- [Connectors and diagrams](./connector-diagram.md): dragging a connector's end onto a site or a free point, the Connector section, a bound shape's move with the connector following during the drag, elbow routes, the export, and an agent's diagram. Journeys `connector-diagram`, `connector-follow`.
- [Set an element's design from the Design panel](./design-panel.md): position and size in points, rotation, flips, align and distribute, a shape's preset and its adjusts, one Opacity for the fill, line, text and picture, a shape's fill, a line's color, width, dash, ends and arrowheads, an element's shadow, glow and soft edge, the text and its colour, size, font, bold, italic, underline, alignment, bullets, line spacing and paragraph spacing, a text box's margins, anchor, wrap, direction and columns, a picture's icon, recolor and crop, an element's name, alt text and hidden flag, a table's cells with their fill and borders, and with nothing selected the deck's theme colours and heading and body fonts, each change one Undo step through `planChange`; the toolbar's Add icon places a Lucide icon. Look states `design-element`, `design-element-changed`, `design-table`, `design-fill`, `design-line`, `design-effects`, `design-shape`, `design-opacity`, `design-text-box`, `design-picture`, `design-theme`; journeys `shape-fill`, `line-style`, `shape-effects`, `appearance-presets`, `shape-geometry`, `opacity`, `text-type`, `picture-icon`, `theme`.
- [Set a slide's background colour](./slide-background.md): the Design panel's theme colours, Undo back to the file's background, the agent tool, and an export that changes only that slide. Journey `slide-background`.
- [Insert and edit a table](./tables.md): `Insert table` and its size picker, typing in cells, rows, undo and the export; a cell's fill and borders from the Design panel or an agent's `set`. Journey `table-fill`; `tests/browser/table-edits.spec.ts`, `tests/browser/table-cells.spec.ts`.
- [Export a deck](./export.md): the Export dialog, PowerPoint or PDF, all slides, the current slide or a range, offline and from the keyboard. Driven through `deck-names`, `speaker-notes` and `picture-add`.
- [Add, duplicate, move and delete slides](./slide-commands.md): the slide list's `Add slide`, Ctrl/Cmd+D, Alt+arrows and Delete. Journeys `slide-commands`, `blank-slides`, `slide-layouts`.
- [Undo and redo the person's edits](./person-undo.md): the keys, the named toolbar buttons for every kind of edit, undo straight after typing, and `Unable to undo`. Journey `person-undo`.
- [Speaker notes](./speaker-notes.md): the notes bar under the slide, on any slide, its undo step, offline and through the export. Journey `speaker-notes`.
- [Slide paint](./slide-paint.md): the opened deck paints each element at its place on a slide of the right shape: text, pictures, shapes, tables, prompts, thumbnails. Journeys `slide-paint`, `dynamic-fonts`, `slide-charts` (SmartArt and charts, read-only, through a duplicate, a delete and the export).
- [Reopen in a cleared browser](./cleared-browser.md): after IndexedDB, local storage and site files are cleared, the saved deck still shows its slide. Journey `cleared-browser`.
- [Delete account](./delete-account.md): the account menu deletes the account after the person types its email; the server, the stored originals and the browser keep nothing of it. Journey `delete-account`.
- [Ask Aira through the server](./aira-turn.md): one metered model call at a time streams text and tool calls, the tool calls run through `/mcp`, the person stops or undoes the run. Journeys `aira-turn`, `agent-after-open` (an ask while the index is on its way, two calls at once, Stop after a call landed).
- [Connected agents](./connected-agents.md): the account menu opens `/settings/agents`, shows and copies the MCP address, lists connected agents, and disconnects one so its access and refresh tokens stop working at once. Journey `connected-agents`.
- [Ask Aira in the Agent panel](./aira-panel.md): the person types to Aira in the open deck, watches the reply stream and the slide change, stops (with Undo for an edit that landed), retries or undoes the run, goes back to earlier chats kept through a reload, and reads the week's usage. Journeys `aira-panel`, `aira-head`, `aira-slides`, `agent-after-open`, and `agent-bench-recorded`, where a recorded agent deck bench trial is scored the way `$V agent-bench` scores one (`../agent-bench.md`).
- [Usage page](./usage-page.md): `/settings/usage` shows the week's Aira usage and when it resets. Journey `usage-page`.
- [Sign in](./sign-in.md): email, six-digit code, the designed mail, session cookie, signed-out redirect. Command `$V sign-in`, journeys `account-name` (signup names and editing names in Account settings), `sign-in-mail`, `sign-in-pages` (the site pages on their own origin) and `signed-out-deck` (a deck address after signing out).
- [Landing page on a phone](./landing-page.md): the site's home page at 390 px, 844 px landscape and 320 px: no sideways scroll, taps 44 px, hover only on a mouse, edges padded for the notch. Journey `landing-pages`; the rules are held by `tests/browser/site-mobile.spec.ts`.
