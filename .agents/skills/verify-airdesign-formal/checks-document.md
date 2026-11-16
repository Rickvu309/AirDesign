# Checks on the edit register, slides, the index and offline replay

Each entry: what the check promises, the code it covers, its bounds, how to run it alone, its replay, what it leaves out, and its sync: the `covers.json` that records the code the model was last confirmed against, or for sections, the commit. Replays live in `tests/spec-replay.test.ts` and the `tests/*-replay.ts` files it calls. Run them with `pnpm vitest run tests/spec-replay.test.ts`.

The register code is `packages/document/src/decide.ts`: `decide` and, per element, `personEdit`, `startRun`, `agentEdit`, `stopRun`, `decideUndo`, `version`. Its product callers are `packages/engine/src/call.ts` (`applyPersonEdits`, `applyAgentEdits`, `startRun`, `stopRun`, `undoRun`, `endOnTouched`, `decideOnElement`, `liveRuns`) and `packages/mcp/src/run.ts` (`openRun`, `joinRun`, `stopLiveRuns`). Text and box rows share one register per element, so "one property" in a model means one element's register.

## edit

One run edits one element while a person edits it too.

- `PersonAlwaysLands`: a person's edit to a present element is never refused. Harm if broken: a person's typing is lost.
- `AgentSawCurrent`: every agent row was written on the version it read, or on its own run's claim. Harm: an agent overwrites text it never saw.
- `ProtectedFromRun` and `GuardedRunRefusesAsProtected`: once a person edits during a run, no later agent row of that run lands, and the refusal is `person-protected` whatever the read. Harm: the agent writes over a person mid-edit.
- `StopFences`: after Stop, no agent row of that run lands. Harm: a stopped agent keeps writing.
- `UndoRevertsOnlyTheRun`: run Undo hides only that run's rows and keeps every person edit. Harm: Undo erases a person's work.

Bounds: one element, one run, two agent rows, one person edit before and one after the run's first row. Assumes the element and its slide are present and its kind takes the edit: `takenRefusal`, the first check in `decide`, refuses a box edit on a grouped element `group-box` and any other edit its kind cannot take `kind`, before this model starts. Group and ungroup change which elements are grouped, so once a group command takes in an element, a box edit of it is refused this way too; structure models grouping. Run: `pnpm check:specs edit`. Replay: `replayEdit` drives every edge through `decide`. Edit, undo and run replays land later agent rows as trait field rows (`set`). Leaves out: agent slide commands under a run (`packages/engine/src/agent-slides.ts`). `agentSlide` refuses `run-fenced` once every element the run touched has ended, and refuses `person-protected` for deleting a slide that holds an element guarded against the run (`packages/engine/src/slide-run-fence.test.ts`). A run with slide rows that stop_run or run Undo ended is recorded in the register's `ended` list, so `agentSlide` refuses its later slide commands `run-fenced` too. slide-run, slide-sibling and slide-undo in [checks-slides.md](checks-slides.md) model them. Speaker notes need no model of their own: a note is the element `<slide>.notes` (`openedRegister` in `packages/engine/src/call.ts`), so a person or agent edit of it goes through `decide` like text, and this model and run, undo and rerun cover it per element. `packages/engine/src/notes.test.ts` checks that both actors use that path. Writing a first note's parts on export is a PowerPoint question for `pnpm check:pptx`, not an order one.

Sync: `specs/edit/covers.json`.

## undo

Undo of a run hides only that run's rows.

- `UndoKeepsPerson`, `PersonRowsStay`: undo leaves every person row. Harm: Undo erases a person's work.
- `EarlierUndoKeepsLater`, `SecondUndoRemovesNothing`: undo of an earlier run never hides a later run's row, and a second undo hides nothing more.
- `LiveRunKeepsEarlier`: while a later run is live, undo of the earlier run is refused and its row stays.
- `CompactKeepsHead`, `HorizonIsGiven`: compaction drops a hidden row only after a horizon, and keeps the person row.
- `VersionNeverReused`: the version never falls, and each change to what the element shows raises it. Harm: a client trusts a stale version and drops an edit.

Bounds: one element, one person row, two runs with one row each. Run: `pnpm check:specs undo`. Replay: `replayUndo` through `decide`, `decideUndo` and `compactChain`. Leaves out: `compactChain` has no product caller, so the compaction half verifies library code nothing runs. Run Undo of slide rows goes through `undoSlides` in `packages/document/src/person-undo.ts`; slide-undo covers it.

Sync: `specs/undo/covers.json`.

## rerun

Two runs on one element in turn: the guard, the claim and the stop mark of each.

- `SecondRunStaysProtected`, `GuardedRunRefusesAsProtected`: a person edit during the second run fences that run.
- `NewRunNeverContinuesOldClaim`, `GuardBelongsToThisRun`: a new run starts with no claim and no guard from the old run. Harm: a new run writes on an old run's read, or is blocked by an old guard.
- `StopFences`: a stopped run lands nothing, and a live run has no stop mark.
- `SecondUndoKeepsOtherRows`: undo of the second run keeps the first run's row and person rows.
- `VersionNeverReused`: as in undo.

Bounds: one element, two runs, the second starting from a stopped or undone first. Run: `pnpm check:specs rerun`. Replay: `replayRerun` through `decide`. Leaves out: as in edit.

Sync: `specs/rerun/covers.json`.

## run

A run's lifecycle: start, stop, undo, a later run, and reads.

- `StartRefusedWhileLive`, `LaterStartUsesAFreshId`: no start replaces a live run, and a later run never reuses an id that owns a row.
- `StopFreezesLandedWrites`, `StoppedOrEndedRejectsWrite`: a stopped run's visible rows never grow, and an undone run shows none of its rows.
- `UndoLeavesTheOtherRun`, `EarlierUndoWaitsForEnd`: undo leaves another run's row, and undo of an earlier run waits for the live run to end.
- `ReadMatchesStoredRun`, `UnstartedHasNoWrites`, `ResumeContinuesSameRun`, `LimitEndsLikeStop`.

Bounds: one element, run ids `s` and `t`, one write, two generations. Run: `pnpm check:specs run`. Replay: `replayRun` through `decide`. Leaves out: `Limit` and `Resume` have no code; the replay counts them as unconnected. The `read` command (`readNodes`) has no product caller. Agent slide rows, as in edit.

Sync: `specs/run/covers.json`.

## offline

The browser's queue of person edits: send, acknowledge, crash, wipe and replay.

- `SentInOrder`, `AckedOnce`, `BatchLandsOnce`: edits go in order, each acknowledgement once, and a batch lands once after a lost answer.
- `StaleSkips`: a queued edit whose base is stale is skipped, not landed.
- `CrashKeepsUnsent`, `WipeClears`, `UndoWaits`.
- `PaintedEditKept`: a typed edit is on the device or in the journal.
- `JoinedTextSent`: a newer keystroke on the same element joins the last queued row only while that row is unsent (`Join`), so whatever is sent carries the newest text. Harm if broken: the server lands the older text and the acknowledgement deletes the row that held the newer one.

Bounds: two queued edits and one stale edit. Run: `pnpm check:specs offline`. Replay: `replayOffline` checks queue edges with `unsent` and land edges with `replay` from `packages/document/src/replay.ts`; a `Join` edge keeps the row's base and replaces its value. The join itself is `valueChange` and `joins` in `packages/live/src/deck-edit.ts` and `joinable` in `deck-view.ts`; `joins` never joins a trait field row (`v`), so such an edit takes a row of its own, as `QueueSecond` does. `sealRows` in `packages/live/src/held.ts` seals the row as stored when sending starts; `packages/live/src/held.test.ts` covers those. Leaves out: the real queue in `packages/live/src/cache.ts` (`sendRows`, `played`) and the server's once key, which [lost-answer](checks-lost-answer.md) models; `Crash`, `Wipe` and `Undo` are unconnected. The device trust stamp of PR 384 is gone: every device row and journal entry lives under the signed-in account's key (`accountKey` in `packages/live/src/device.ts`), so the next person to sign in on a browser reads none of the first person's rows, whichever way the first session ended. `replay` throws on a refused person edit; `played` applies slide commands after it, so a `dead` refusal cannot reach it today. A tab whose store a newer build opened, or that reads a row or a register answer at a newer `format`, refuses every call with `newer` and writes, sends and deletes nothing; the model has no second build, and `packages/live/src/format.test.ts` covers it.

Sync: `specs/offline/covers.json`.

## index

The import index: the browser's page queue, the server's stored pages, and the one rule for every change to what the index holds: a device at a higher format sends the whole index again, and the server builds it beside the stored one and swaps it in whole.

- `OnlyEditsChangeRevision`: storing, building beside, swapping or refusing an index page never changes the deck revision. Harm: an agent's read goes stale for no edit.
- `AcknowledgedIsStored`, `PagesStayOrdered`: the browser counts a page as sent only after the server stored it, in order, or refused the re-send it belongs to.
- `SwapIsWhole`: the stored index is never part of a newer one. Harm: an agent reads a deck with half its elements.
- `SwapKeepsOpening`: a re-send whose opening values differ from the stored ones never reaches the server, beside the stored index or in it. Harm: rows fold over a value the deck never held.
- `ResendReachesServer`: once the re-sent queue is acknowledged, the server holds the newer index. Harm: the deck never gets roles and design, and every open sends it again.
- `StoredOnlyGrows` (a property): the stored index is never deleted or rewritten in place; its pages only grow, and its format only rises by a whole swap. Harm: a deck stored before the format rose loses its index.

Bounds: two pages, one crash, one edit, one re-send, which starts once the older index is complete and either keeps or changes every opening value (`drift`). Run: `pnpm check:specs index`. Replay: `tests/index-replay.ts` drives `Store` and `Edit` through `indexDeck` and `readDeckPage`, with format 1 pages from the older queue and format 2 pages with roles, design and layouts from the re-sent one; it checks the stored format, the pages built beside (`next`), refusals, and that no opening value or stored page changes. Code: `indexDeck` in `packages/engine/src/index-deck.ts`, `appendIndex`, `indexDue` and `answeredRegister` in `packages/document/src/deck-index.ts`, and `keepIndex` and `sendIndex` in `packages/live/src/deck-index.ts`. `apps/api/src/saved.ts` and `packages/live/src/remote.ts` put `answeredRegister` on the open answer: it hands the device the stored index without the pages built beside it, and the editor reads that index's format with `indexDue` (`apps/web/src/editor/use-deck-open.ts`) to queue the re-send. The answer's own `format`, the highest of the stored index, the pages built beside and the rows, feeds the newer-build refusal, not the re-send. `Ack` advances the count only if the queue slot still holds the queue its send loop read (`swapSlot` with the queue's `once`); an answer to a page sent before the re-send leaves the new queue alone, and the loop reads it again. A refused page ends its queue (`sendIndex` writes `sent = count`), so the rows behind it still send. The slot is found under the signed-in account's key (`scoped` in `packages/live/src/device.ts`), and the read and the write are one readwrite transaction on the page's long-lived connection (`putSlots` in `packages/live/src/store.ts`). `Ack` needs the page in flight to have landed (`landed`), since the browser hears back only after the server stored it. Leaves out: a re-send that starts before the older index is complete (`deck-index.test.ts` covers building beside a partial index), a re-send whose pages drift only in part, and that a refused re-send ends its queue, which is a liveness promise: `packages/live/src/deck-index-upgrade.test.ts` covers it, and the in-flight re-send race, against `packages/live`.

Sync: `specs/index/covers.json`.

## sections

A deck's PowerPoint sections carried through the slide command log by `foldSections` in `packages/document/src/section-order.ts`, which the slide list and export (`packages/pptx/src/slide-order-route.ts`) both read.

This is a pure function of the log, with no concurrency, so it has no TLA+ model. A property test runs the real code on generated logs of add, duplicate, move, delete and restore over two sections: `packages/document/src/section-order.property.test.ts`.

- Every present slide is in exactly one section, the sections are runs in slide order, and every section name is kept, an emptied one included. Harm if broken: export drops a section name or lists a slide twice.
- A person's undo of an add, a duplicate, a move, a delete or a restore gives back the sections from before it. A move back to a key the slide held before takes the section it had at that key, so Run Undo of a move does the same.

Bounds: four slides in two sections split anywhere, logs of up to six commands, 300 runs each. Run: `pnpm vitest run packages/document/src/section-order.property.test.ts`. Code: `foldSections`, `slideUndoable` and `undoOf`. Leaves out: three or more sections, and export's own writing of the section list, which `pnpm check:pptx` judges.

Sync: `c757fd3d4819dabeb077254205e44a7214da780b`.
