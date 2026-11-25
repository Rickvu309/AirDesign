# AirDesign verification map

This directory is the maintained source for verifying what an AirDesign user does. Read this index before driving the app, then use the matching feature file as the recipe. Driving commands are in `../SKILL.md`; below, `V` is `.agents/skills/verify-airdesign/bin/verify-airdesign.mjs`, run from the repo root.

## The journey suite

`pnpm test:journeys` runs every journey in `journeys/` against one stack, through `tests/journeys/journeys.spec.ts`; a new journey file runs there once it is listed in that file. `ci` runs it on a pull request whose change map reaches journeys. [journey-suite.md](../journey-suite.md) has the details.

## Baseline preconditions

- `$V launch` printed a run id and `$V doctor <run>` printed `"ok":true`.
- The run is yours. Never drive an instance another run or agent started.
- The database starts empty: no accounts, no decks. Each journey signs in a new account, so journeys do not depend on each other.

## Driving conventions

- Start each journey from Home `/` as a signed-in person, the way a user arrives.
- Prefer roles and accessible names, then the app's data attributes (`data-slide-box` for the canvas, `data-node="<id>"` for a painted layer, `data-slide-entry` for a slide in the list, `data-editor-ready` once the deck painted), then `[contenteditable="true"]`.
- Take every API path from `deckRoutes`, `doomRoutes` or `signInRoutes`. Never type one.
- The app paints before the network. After a UI action, wait for the server copy with `expect.poll` on `doomRoutes.open` or `deckRoutes.list` before you call it saved.

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

- [Start a deck and edit its text](./open-edit-save.md): New deck opens `/s/<id>` with a title, and the Describe your deck box opens one and sends your words to Aira; double-click or T to edit, the text bar and its keys format it, the server keeps it and a reload shows it. Specs `editor.spec.ts`, `editor-text.spec.ts`, `editor-text-format.spec.ts`; look states `blank-deck`, `text-format-bold`.
- [Deck list and Trash](./deck-list-trash.md): Recents' six newest decks with thumbnails, `No decks yet`, starring and the Starred list, Move to Trash and Undo, Restore, Empty Trash. Journey `deck-list-trash`; spec `home.spec.ts`.
- [Deck names, search and All decks](./deck-names.md): `All decks`, the sidebar search, renaming from the editor's title, a name taken from slide 1's title. Journey `deck-list-trash`; spec `editor-page.spec.ts`; look states `decks-all`, `decks-search-match`, `editor-renaming`, `editor-rename-refused`.
- [Keep edits on the device and paint from it](./keep-typed-text.md): edits queue on the device through a reload, a closed tab or offline, paint before the server answers, stay with the account, and open from the server on a fresh device. Tests `packages/live/src/doom-deck.test.ts`, `device-account.test.ts`; spec `editor-picture.spec.ts`.
- [Zoom and pan the slide](./navigate-zoom-pan.md): Ctrl+scroll or a Chrome pinch zooms about the cursor, Space or the hand tool pans, Shift+2 zooms to the selection, Shift+1 fits, Shift+0 is 100%, and the zoom menu. Spec `editor-view.spec.ts`; look states `zoom-selection`, `zoom-menu`.
- [Move and resize an element](./move-resize.md): select a layer, drag it, resize from corners or sides with Shift/Alt, turn with the rotate zones and Shift 15-degree steps, flip with Shift+H/V, snap and spacing guides, Alt-drag and Ctrl+D copies, Ctrl+C/X/V, arrow nudges; the server keeps the box. Specs `editor.spec.ts`, `editor-transform.spec.ts`, `editor-arrange.spec.ts`, `editor-arrange-keys.spec.ts`; look states `layer-snap-held`, `layer-spacing-held`, `layer-resize-held`, `layer-rotate-held`, `layer-duplicated`, `layer-pasted`, `canvas-drag-held`, `canvas-drag-landed`.
- [Select layers on a slide](./canvas-select.md): click a group whole, Shift+click to add, Cmd/Ctrl+click inside a group or frame, double-click to step in, Shift+Enter and Escape to step out, marquee and Shift+marquee, Ctrl+A, hover outline, lock and hide. Spec `editor-select.spec.ts`; look states `canvas-marquee`, `canvas-hover`, `two-selected`, `group-stepped-in`.
- [Add a text layer and delete a layer](./element-edits.md): the Text tool's click and drag, editing by double-click or Enter, an emptied text removed, Delete on a selected layer, and their undo. Specs `editor-text.spec.ts`, `editor.spec.ts`; look states `text-tool-placed`, `element-added`, `element-deleted`, `emptied-text-left`.
- [Add a picture](./picture-add.md): a dropped or pasted picture file, its undo, the upload while offline, another device, and an image fill from the Design panel. Spec `editor-picture.spec.ts`; look states `picture-added`, `picture-uploading`.
- [Insert a shape](./shape-insert.md): `Shapes` in the toolbar or R, O, L, Shift+L and F draw a rectangle, ellipse, line, arrow, frame or a preset where it is dragged or clicked. Spec `editor-tools.spec.ts`; look states `shape-tray`, `shape-grid`, `shape-drawing`, `shape-added`.
- [Bring an element forward or send it backward](./element-order.md): `]` and `[` to the front and back, Ctrl/Cmd+`]` and `[` one place, among a layer's siblings. Specs `editor-arrange.spec.ts`, `editor-arrange-keys.spec.ts`; look state `element-ordered`.
- [Group and ungroup elements](./group-elements.md): Shift+click, Ctrl+G, Ctrl+Shift+G or Ctrl+Backspace, Ctrl+Alt+G frame, moving and scaling a group, layers moved inside it, and undo. Specs `editor-arrange-keys.spec.ts`, `editor-arrange.spec.ts`, `editor-select.spec.ts`, `editor-transform.spec.ts`; look states `group-layer-moved`, `group-layer-turned`, `group-fits`.
- [Auto layout frames](./auto-layout-frame.md): a frame that lays its children in a row or column, hug, fixed and fill sizing, a child picked by double-click, a growing text child, Remove auto layout, and the agent's wrap and frame. Spec `editor-design.spec.ts`; look states `frame-auto-child`, `frame-fixed`, `frame-fill-resizing`, `frame-text-undone`, `frame-nested`.
- [Connectors and diagrams](./connector-diagram.md): a line whose ends sit on layers follows them during a drag; the agent's line and flow pattern. Look states `connector-follow`, `connector-around`, `panel-connector`.
- [Set an element's design from the Design panel](./design-panel.md): Align and Distribute, a text layer's style, weight, size, formats, lists, colour and link, a fill (solid, gradient, image), a picture's fit and Replace, border style and colour, Remove auto layout, selection colours, and the slide's background and theme. Specs `editor-design.spec.ts`, `editor-gradient-fill.spec.ts` and the `control-*` specs; look states `design-element`, `design-fill`, `design-border`, `design-effects`, `design-template`, `design-theme-options`, `design-theme-custom`, `panel-text`, `panel-shape`.
- [Set a slide's background](./slide-background.md): with nothing selected, Design shows the slide's Background (solid, gradient, colour or picture) and Theme; undo, reload, and an agent's fill. Specs `editor-design.spec.ts`, `editor-gradient-fill.spec.ts`.
- [Add, duplicate, move and delete slides; present](./slide-commands.md): `Add slide`, the starting slides, Enter, Ctrl/Cmd+D, Alt+arrows, drag, Delete, the slide menu, undo, and Present with the presenter view. Specs `editor-slides.spec.ts`, `editor-slides-transform.spec.ts`, `editor-presenting.spec.ts`.
- [Undo and redo the person's edits](./person-undo.md): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y for every edit, undo while typing, and an undo that leaves another writer's change alone. Specs `editor.spec.ts`, `editor-transform.spec.ts`, `editor-text.spec.ts`, `editor-arrange-keys.spec.ts`; look states `text-undone`, `three-undone`. Journeys `linked-offline-undo`, `linked-label-undo`, `linked-refused-undo` and `linked-chart-refresh`.
- [Speaker notes](./speaker-notes.md): the presenter notes bar under the slide, one per slide, kept through a reload and shown in the presenter view. Spec `editor-page.spec.ts`; look states `notes-open`, `notes-typed`.
- [Slide paint](./slide-paint.md): each layer paints at its box on a slide of the deck's size, fonts load by name, thumbnails in the list and on Home. Tests `packages/render/src`; spec `editor.spec.ts`; look states `slide-effects`, `slide-chart`, `font-catalog`.
- [Component paths](./component-paths.md): wedges and polylines paint in the editor, filmstrip, slide capture and PDF. Journeys `component-paths` and `path-paint`.
- [Diagram templates](./diagram-templates.md): process, architecture and cycle specs paint in the editor, filmstrip and PDF, and a moved card keeps its connectors. Journey `diagram-templates`.
- [Delete account](./delete-account.md): the account menu deletes the account after the person types its email; the server, the stored pictures and the browser keep nothing of it. Test `apps/api/src/delete-account.test.ts`; spec `account.spec.ts`; look state `account-delete-ask`.
- [Ask Aira through the server](./aira-turn.md): one metered model call at a time streams text and tool calls, the tool calls run through `/mcp`, the person stops or undoes the run.
- [Connected agents](./connected-agents.md): the account menu opens `/settings/agents`, shows and copies the MCP address, lists connected agents, and disconnects one so its access and refresh tokens stop working at once. Journeys `connected-agents` and `consulting-mcp`.
- [Ask Aira in the Agent panel](./aira-panel.md): the person types to Aira in the open deck, watches the reply stream and the slide change, stops (with Undo for an edit that landed), retries or undoes the run, goes back to earlier chats kept through a reload, and reads the week's usage. Journey `aira-panel`.
- [Usage page](./usage-page.md): `/settings/usage` shows weekly Aira usage and its reset date, credits, Auto reset, and reset history. Journey `usage-page`.
- [Sign in](./sign-in.md): email, six-digit code, the designed mail, session cookie, signed-out redirect. Command `$V sign-in`, journeys `account-name` (signup names and editing names in Account settings), `sign-in-mail` and `sign-in-pages` (the site pages on their own origin); look state `deck-signed-out` (a deck address after signing out).
- [Landing page on a phone](./landing-page.md): the site's home page at 390 px, 844 px landscape and 320 px: no sideways scroll, taps 44 px, hover only on a mouse, edges padded for the notch. Journey `landing-pages`; the rules are held by `tests/browser/site-mobile.spec.ts`.
