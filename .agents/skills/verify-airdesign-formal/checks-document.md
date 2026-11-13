# Checks on the edit register, slides, the index and offline replay

Each entry: what the check promises, the code it covers, its bounds, how to run it alone, its replay, what it leaves out, and the sync commit where the model was last confirmed against the code. Replays live in `tests/spec-replay.test.ts` and the `tests/*-replay.ts` files it calls. Run them with `pnpm vitest run tests/spec-replay.test.ts`.

The register code is `packages/document/src/decide.ts`: `decide` and, per element, `personEdit`, `startRun`, `agentEdit`, `stopRun`, `decideUndo`, `version`. Its product callers are `packages/engine/src/call.ts` (`applyPersonEdits`, `applyEdits`, `startRun`, `stopRun`, `undoRun`, `endOnTouched`, `decideOnElement`, `liveRuns`) and `packages/mcp/src/run.ts` (`openRun`, `joinRun`, `stopLiveRuns`). Text and box rows share one register per element, so "one property" in a model means one element's register.

## edit

One run edits one element while a person edits it too.

- `PersonAlwaysLands`: a person's edit to a present element is never refused. Harm if broken: a person's typing is lost.
- `AgentSawCurrent`: every agent row was written on the version it read, or on its own run's claim. Harm: an agent overwrites text it never saw.
- `ProtectedFromRun` and `GuardedRunRefusesAsProtected`: once a person edits during a run, no later agent row of that run lands, and the refusal is `person-protected` whatever the read. Harm: the agent writes over a person mid-edit.
- `StopFences`: after Stop, no agent row of that run lands. Harm: a stopped agent keeps writing.
- `UndoRevertsOnlyTheRun`: run Undo hides only that run's rows and keeps every person edit. Harm: Undo erases a person's work.

Bounds: one element, one run, two agent rows, one person edit before and one after the run's first row. Assumes the element and its slide are present and the edit is not a box edit on a grouped element (those are refused `dead` or `group-box` first). Run: `pnpm check:specs edit`. Replay: `replayEdit` drives every edge through `decide`. Leaves out: agent slide commands under a run (`packages/engine/src/agent-slides.ts`). `agentSlide` refuses `run-fenced` once every element the run touched has ended, and refuses `person-protected` for deleting a slide that holds an element guarded against the run (`packages/engine/src/slide-run-fence.test.ts`). A run with slide rows that stop_run or run Undo ended is recorded in the register's `ended` list, so `agentSlide` refuses its later slide commands `run-fenced` too. slide-run and slide-undo in [checks-server.md](checks-server.md) model them. Speaker notes need no model of their own: a note is the element `<slide>.notes` (`openedRegister` in `packages/engine/src/call.ts`), so a person or agent edit of it goes through `decide` like text, and this model and run, undo and rerun cover it per element. `packages/engine/src/notes.test.ts` checks that both actors use that path. Writing a first note's parts on export is a PowerPoint question for `pnpm check:pptx`, not an order one.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## undo

Undo of a run hides only that run's rows.

- `UndoKeepsPerson`, `PersonRowsStay`: undo leaves every person row. Harm: Undo erases a person's work.
- `EarlierUndoKeepsLater`, `SecondUndoRemovesNothing`: undo of an earlier run never hides a later run's row, and a second undo hides nothing more.
- `LiveRunKeepsEarlier`: while a later run is live, undo of the earlier run is refused and its row stays.
- `CompactKeepsHead`, `HorizonIsGiven`: compaction drops a hidden row only after a horizon, and keeps the person row.
- `VersionNeverReused`: the version never falls, and each change to what the element shows raises it. Harm: a client trusts a stale version and drops an edit.

Bounds: one element, one person row, two runs with one row each. Run: `pnpm check:specs undo`. Replay: `replayUndo` through `decide`, `decideUndo` and `compactChain`. Leaves out: `compactChain` has no product caller, so the compaction half verifies library code nothing runs. Run Undo of slide rows goes through `undoSlides` in `packages/document/src/person-undo.ts`; slide-undo covers it.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## rerun

Two runs on one element in turn: the guard, the claim and the stop mark of each.

- `SecondRunStaysProtected`, `GuardedRunRefusesAsProtected`: a person edit during the second run fences that run.
- `NewRunNeverContinuesOldClaim`, `GuardBelongsToThisRun`: a new run starts with no claim and no guard from the old run. Harm: a new run writes on an old run's read, or is blocked by an old guard.
- `StopFences`: a stopped run lands nothing, and a live run has no stop mark.
- `SecondUndoKeepsOtherRows`: undo of the second run keeps the first run's row and person rows.
- `VersionNeverReused`: as in undo.

Bounds: one element, two runs, the second starting from a stopped or undone first. Run: `pnpm check:specs rerun`. Replay: `replayRerun` through `decide`. Leaves out: as in edit.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## run

A run's lifecycle: start, stop, undo, a later run, and reads.

- `StartRefusedWhileLive`, `LaterStartUsesAFreshId`: no start replaces a live run, and a later run never reuses an id that owns a row.
- `StopFreezesLandedWrites`, `StoppedOrEndedRejectsWrite`: a stopped run's visible rows never grow, and an undone run shows none of its rows.
- `UndoLeavesTheOtherRun`, `EarlierUndoWaitsForEnd`: undo leaves another run's row, and undo of an earlier run waits for the live run to end.
- `ReadMatchesStoredRun`, `UnstartedHasNoWrites`, `ResumeContinuesSameRun`, `LimitEndsLikeStop`.

Bounds: one element, run ids `s` and `t`, one write, two generations. Run: `pnpm check:specs run`. Replay: `replayRun` through `decide`. Leaves out: `Limit` and `Resume` have no code; the replay counts them as unconnected. The `read` command (`readNodes`) has no product caller. Agent slide rows, as in edit.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## structure

Adding and removing an element, and a run's read of the element list.

- `StructuralRecord`: an add or remove changes only the named element.
- `ReadSetHeld`: a read keeps the element list it saw.
- `AbsentEditLeavesCounts`: an edit naming an absent element changes no counts.

Bounds: two elements, `a` always present. Run: `pnpm check:specs structure`. Replay: `replayStructure` through `decide` `add`, `remove` and `read`. Leaves out: product code adds a register with `add` (`openedRegister` in `call.ts`, `opened` in `packages/live/src/cache.ts`) and uses `remove` only to put a restored register back (`decideOnElement`). `read` has no product caller. A person's element add and remove go through slide commands, covered by element.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## offline

The browser's queue of person edits: send, acknowledge, crash, wipe and replay.

- `SentInOrder`, `AckedOnce`, `BatchLandsOnce`: edits go in order, each acknowledgement once, and a batch lands once after a lost answer.
- `StaleSkips`: a queued edit whose base is stale is skipped, not landed.
- `CrashKeepsUnsent`, `WipeClears`, `UndoWaits`.

Bounds: two queued edits and one stale edit. Run: `pnpm check:specs offline`. Replay: `replayOffline` checks queue edges with `unsent` and land edges with `replay` from `packages/document/src/replay.ts`. Leaves out: the real queue in `packages/live/src/cache.ts` (`sendRows`, `played`) and the server's once key; `Crash`, `Wipe` and `Undo` are unconnected. The device journal of PR 385 (`PaintedEditKept`, a second tab, a crash between the journal write and the device write) is not merged at the sync commit and is not modeled. The device trust stamp of PR 384 (`packages/live/src/trust.ts`) has no model: its rule is that every path that ends a session withdraws the stamp, which is a list of code paths, not an order of steps, so a model would only repeat the list by hand. Two paths miss it, from `7e5fd6b9`: `signOut` in `apps/web/src/settings/settings-page.tsx` (Settings and its account menu) and the deck list's session refusal in `apps/web/src/decks/home.tsx`. After either, the next person to sign in on that browser who opens the first person's deck address sees it painted from the device until the server refuses it. Reproduced by the `it.fails` tests in `apps/web/src/settings/sign-out.test.ts` and `apps/web/src/decks/home-session.test.tsx`. A session that ends by its 30-day age with no request from the editor in between misses it too. `replay` throws on a refused person edit; `played` applies slide commands after it, so a `dead` refusal cannot reach it today.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## person-undo

A person's Undo and Redo of their own text edit, beside an agent run.

- `UndoShowsBefore`: an undo or redo shows exactly the text it went back to.
- `NeverCoversAgent`, `AgentRowStays`: a person's undo never lands over an agent row that shows, and only the run's own Undo hides that row. Harm: a person's Ctrl+Z erases Aira's work.
- `DroppedIsTold`: an undo that changed nothing is always told.

Bounds: up to four person rows, one agent row. Run: `pnpm check:specs person-undo`. Replay: `tests/person-undo-replay.ts` through `undoOf`, `redoOf` and `decide`. Code: `undoOf`, `redoOf` in `packages/document/src/person-undo.ts`, the stack in `apps/web/src/undo-list.ts`. Leaves out: box undo and slide undo (`slideUndoable`), and notes edits. Box, element add and remove and notes undo arrive with PR 383, not merged at the sync commit; when it merges, model them here with another tab and an agent interleaving, and replay every edge.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## element

A text box a person adds, types in and removes.

- `RemovedWasAdded`, `TypedWhileShown` are guards of the model. The promise lives in the replay: after a remove, add, type and remove of that id are refused, and `nextElementId` never hands an added id out again. Harm: a deleted text box comes back or its id is reused.

Bounds: one element on one slide. Run: `pnpm check:specs element`. Replay: `tests/element-replay.ts` through `call("commit_edits")` and `readDeckPage` in `packages/engine`, and `nextElementId`. Code: `elementRefusal`, `elementGone`, `nextElementId` in `packages/document/src/element-order.ts`, `applySlide` in `slide-order.ts`, the `dead` check in `decide`. Leaves out: other elements and other slides, and the layout a new slide takes (`layout` and `layoutPart` on `add` change only the opening elements the command carries and the part the export points at, never an order or a refusal). A duplicate leaves removed elements out of its copy, for an agent (`agentSlide` in `packages/engine/src/agent-slides.ts`, tested by `packages/engine/src/duplicate-removed.test.ts`) and for a person (`flooredEdit` in `apps/web/src/slide-floor.ts`, tested in `apps/web/src/slide-copy.test.ts`); no spec models the duplicate.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## index

The import index: the browser's page queue, the server's stored pages, and the one layout upgrade.

- `OnlyEditsChangeRevision`: storing or replaying an index page never changes the deck revision. Harm: an agent's read goes stale for no edit.
- `AcknowledgedIsStored`, `PagesStayOrdered`: the browser counts a page as sent only after the server stored it, in order.
- `UpgradeReachesServer`: once the upgraded queue is acknowledged, the server holds the layouts. Harm: the browser marks the deck layered while the server has no layouts, and agents cannot add a slide from them.

Bounds: two pages, one crash, one edit, one upgrade. Run: `pnpm check:specs index`. Replay: `tests/index-replay.ts` drives `Store` and `Edit` through `indexDeck` and `readDeckPage`, with layouts on pages from the upgraded queue. Code: `indexDeck` in `packages/engine/src/index-deck.ts`, `appendIndex` in `packages/document/src/deck-index.ts`, `keepIndex` and `sendIndex` in `packages/live/src/deck-index.ts`. `Ack` advances the count only if the queue slot still holds the queue its send loop read (`swapSlot` with the queue's `once`); an answer to a page sent before an upgrade leaves the new queue alone, and the loop reads it again. `Ack` needs the page in flight to have landed (`landed`), since the browser hears back only after the server stored it. Leaves out: the browser queue steps are not replayed against `packages/live`, except the lost upgrade in `packages/live/src/deck-index-upgrade.test.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## sections

A deck's PowerPoint sections carried through the slide command log by `foldSections` in `packages/document/src/section-order.ts`, which the slide list and export (`packages/pptx/src/slide-order-route.ts`) both read.

This is a pure function of the log, with no concurrency, so it has no TLA+ model. A property test runs the real code on generated logs of add, duplicate, move, delete and restore over two sections: `packages/document/src/section-order.property.test.ts`.

- Every present slide is in exactly one section, the sections are runs in slide order, and every section name is kept, an emptied one included. Harm if broken: export drops a section name or lists a slide twice.
- A person's undo of an add, a duplicate, a move, a delete or a restore gives back the sections from before it. A move back to a key the slide held before takes the section it had at that key, so Run Undo of a move does the same.

Bounds: four slides in two sections split anywhere, logs of up to six commands, 300 runs each. Run: `pnpm vitest run packages/document/src/section-order.property.test.ts`. Code: `foldSections`, `slideUndoable` and `undoOf`. Leaves out: three or more sections, and export's own writing of the section list, which `pnpm check:pptx` judges.

Sync: `c757fd3d4819dabeb077254205e44a7214da780b`.
