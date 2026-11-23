# Checks on an edit the tab cannot write

Same fields as [checks-document.md](checks-document.md). The replay drives the tab's writer: `pnpm vitest run apps/web/src/left-out-replay.test.ts`.

## left-out

Edits the server accepted for one deck while a page writes them into the deck's PowerPoint file, each one either writable or not. Before this check, one edit the writer threw on (`text-run`, `text-paragraph`, `text-body`) stopped every later paint and the deck never opened again, because the edit stays in the history every page replays.

- `ShowsEveryWritableEdit`: an open page shows every edit the tab can write. Harm if broken: the deck opens without edits it could show, or not at all.
- `LeavesOutOnlyUnwritable`: the page leaves out only edits it cannot write. Harm if broken: a good edit silently missing from the slides and the export.
- `ToldWhenLeftOut`: an open page tells the person exactly when it left an edit out, with "Unable to show some edits". Harm if broken: an export that silently drops an edit.
- `OpensEventually`: every paint ends with the deck open, however many edits it cannot write.

Bounds: three edits, one reload. TLC checks 155 states. The model holds its sets as bit masks (`bad`, `left`, `shown`) because the replay's graph reader takes only scalars. `Try` is one pass of `keptExport` in `packages/pptx/src/kept-export.ts`: it writes the edits not left out and, when that throws, `firstUnwritable` bisects to the first layer and then to the first landed row of that layer that does not write, and leaves that row out (or the whole layer when its opening does not write or its stored state cannot be read). `writtenDeck` in `written-deck.ts` does the same for slide commands. A reload starts a page with no memory of what it left out (`knownLeftOut` is per parts object). Run: `pnpm check:specs left-out`. Replay: `apps/web/src/left-out-replay.test.ts` builds each reachable history on one layer of `clean.pptx` (a writable edit sets its border width, an unwritable one names a paragraph the layer does not have), writes it with `exportedDeck`, and checks the left-out rows, the notice and the written border against the state; a `Reload` edge writes from a fresh parts object. Code: `keptExport` and `firstUnwritable` in `kept-export.ts`, `writtenDeck`, `exportedDeck` and `editedDeck` in `apps/web/src/editing/exported-parts.ts`, and `paint` in `apps/web/src/deck-paint.ts`, which reports what it left out. No product path calls `exportedDeck` or `paint`: their callers are this replay and `deck-paint.test.ts`. Leaves out: an edit that writes on its own but not after another one (the model makes each edit's writability fixed); paint draws a text-only edit from its value without writing the file, so a text-only unwritable edit is shown on the canvas and left out of the export, which tells the person then (`deck-paint.test.ts` covers paint's own notice).

Sync: `specs/left-out/covers.json`.
