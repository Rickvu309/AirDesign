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

Bounds: one element, one run, two agent rows, one person edit before and one after the run's first row. Assumes the element and its slide are present and its kind takes the edit (a box edit on a grouped element is refused `group-box`, and any other edit its kind cannot take is refused `kind`, before this model starts). Run: `pnpm check:specs edit`. Replay: `replayEdit` drives every edge through `decide`. Leaves out: agent slide commands under a run (`packages/engine/src/agent-slides.ts`). `agentSlide` refuses `run-fenced` once every element the run touched has ended, and refuses `person-protected` for deleting a slide that holds an element guarded against the run (`packages/engine/src/slide-run-fence.test.ts`). A run with slide rows that stop_run or run Undo ended is recorded in the register's `ended` list, so `agentSlide` refuses its later slide commands `run-fenced` too. slide-run, slide-sibling and slide-undo in [checks-slides.md](checks-slides.md) model them. Speaker notes need no model of their own: a note is the element `<slide>.notes` (`openedRegister` in `packages/engine/src/call.ts`), so a person or agent edit of it goes through `decide` like text, and this model and run, undo and rerun cover it per element. `packages/engine/src/notes.test.ts` checks that both actors use that path. Writing a first note's parts on export is a PowerPoint question for `pnpm check:pptx`, not an order one.

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
- `PaintedEditKept`: a typed edit is on the device or in the journal.
- `JoinedTextSent`: a newer keystroke on the same element joins the last queued row only while that row is unsent (`Join`), so whatever is sent carries the newest text. Harm if broken: the server lands the older text and the acknowledgement deletes the row that held the newer one.

Bounds: two queued edits and one stale edit. Run: `pnpm check:specs offline`. Replay: `replayOffline` checks queue edges with `unsent` and land edges with `replay` from `packages/document/src/replay.ts`; a `Join` edge keeps the row's base and replaces its value. The join itself is `valueChange` and `joinable` in `packages/live/src/deck-edit.ts` and `deck-view.ts`, and `sealRows` in `packages/live/src/held.ts` seals the row as stored when sending starts; `packages/live/src/held.test.ts` covers those. Leaves out: the real queue in `packages/live/src/cache.ts` (`sendRows`, `played`) and the server's once key, which [lost-answer](checks-lost-answer.md) models; `Crash`, `Wipe` and `Undo` are unconnected. The device trust stamp of PR 384 is gone: every device row and journal entry lives under the signed-in account's key (`accountKey` in `packages/live/src/device.ts`), so the next person to sign in on a browser reads none of the first person's rows, whichever way the first session ended. `replay` throws on a refused person edit; `played` applies slide commands after it, so a `dead` refusal cannot reach it today. A tab whose store a newer build opened, or that reads a row or a register answer at a newer `format`, refuses every call with `newer` and writes, sends and deletes nothing; the model has no second build, and `packages/live/src/format.test.ts` covers it.

Sync: `6be7cad84aa47f389c95207dc57fd5cab2b2fd21`.

## element

A text box, a table or a picture a person adds, types in and removes, the person's Undo and Redo of the add or the removal, another tab removing it or bringing it back in between, an agent's run that adds a text box or removes the element with the run's Undo, the picture's bytes reaching the server, and an export of the deck on another device.

- `RemovedWasAdded`, `TypedWhileShown`, `TraitTakenByKind`, `UploadedWasAdded` are guards of the model. The promise lives in the replay: after a remove, add, type and remove of that id are refused, a restore of an element that shows is refused, and `nextElementId` never hands an added id out again, for a person and for `add_text_box`. Harm: a deleted text box, table or picture takes edits or its id is reused.
- `UndoShowsBefore`: an undo shows whether the element showed before the person's add or removal, and a redo shows the edit again. Harm: Ctrl+Z after adding a box, a table or a picture leaves it, or after deleting one leaves it gone.
- `DroppedIsTold`: an undo or redo after someone else changed whether the element shows changes nothing and is told. Harm: a person's undo removes a box another tab brought back.
- `RunUndoRestores`, `RunUndoOnlyUnchanged`: a run's Undo leaves the element as it was before the run (gone after an add, back after a removal), and lands only while the element still shows as the run left it and no person typed in a box the run added. Anything else is refused `run-fenced`, and nothing changes. Harm: Undo of an agent's run deletes text a person typed, or brings back an element a person removed.
- The replay also drives `AgentRemoveRefused`: an agent's `delete_element` on a box a person typed in after the run added it is refused `person-protected`.
- `ExportHasBytes`: a deck with a picture exports on another device only once the picture's bytes uploaded. The replay checks that `addedPictures` lists the picture's hash in every state that holds it, so the editor's export check (`missingPictures`, `exportablePictures` in `apps/web`) refuses while the bytes are missing. An export reflects the deck at that moment, so every later step clears `exported`. Harm: another device writes a PowerPoint file whose picture points at a missing media part.

Bounds: one element on one slide, one undo entry, one agent run that adds, removes, or adds and removes, one picture's bytes. A person's own Undo and Redo and Remove are modelled only while no agent run touched the element. Run: `pnpm check:specs element`. Replay: `tests/element-replay.ts` reaches every state through the code (`call("commit_edits")`, `call("add_text_box")`, `call("delete_element")`, `call("undo_run")`, `undoOf`, `redoOf`) and checks every edge and every forbidden action, twice: once with a text box and once with a table as the element a person's `Add` makes. `Upload` and `ExportElsewhere` change no register, so the replay checks them against `addedPictures` only. Code: `elementRefusal`, `elementGone`, `nextElementId`, `addedPictures` in `packages/document/src/element-order.ts`, the element branch of `slideUndoable`, `turn` and `undoableAt` in `person-undo.ts`, `slideMeasure` in `slide-measure.ts`, `agentElement` in `packages/engine/src/agent-elements.ts`, `applySlide` in `slide-order.ts`, the `dead` check in `decide`. A table's `Type` is one edit of its value: a typed cell and an added row, as `changedTable` in `packages/document/src/table-value.ts` writes them, and `openedTable` there decides which table an add may carry. Leaves out: other elements and other slides; the layout a new slide takes (`layout` and `layoutPart` on `add` change only the opening elements the command carries and the part the export points at, never an order or a refusal); the animated-shape refusal (`locked`), which depends on the index (`packages/engine/src/agent-elements.test.ts`, `packages/document/src/element-order.test.ts`); where a new text box, table or picture lands (`placeNewBox`, tested in `packages/document/src/box-placement.test.ts`); the table value's own rules (rows, cells, `from`), which `table-value.test.ts` covers; the upload itself (`flushMedia` in `packages/live`, `/decks/media/upload` in `apps/api`), which `packages/live/src/media.test.ts` and `apps/api/src/media.test.ts` cover; and export, where `orderedParts` in `packages/pptx/src/slide-order-route.ts` applies each slide's net element change, a table through `graphicFrame.addTable` and a picture through `addPicture`, and gives a copy the elements its slide showed when it was copied (`packages/pptx/src/element-order.test.ts`). Stacking an element (`element-order`, `elementStacks` and `stackRefusal` in `packages/document/src/element-stack.ts`, and the stack branch of `turn`) changes which sibling it sits before and never whether it shows or which id comes next, so this model leaves it out. A duplicate leaves removed elements out of its copy, for an agent (`agentSlide` in `packages/engine/src/agent-slides.ts`, tested by `packages/engine/src/duplicate-removed.test.ts`) and for a person (`flooredEdit` in `apps/web/src/slide-floor.ts`, tested in `apps/web/src/slide-copy.test.ts`); no spec models the duplicate. Known gap: a second Undo of the same run lands again if a person brought the element back to the state the run left it in. `TraitTakenByKind` is the admission rule: the server admits a row only on a trait field the element's kind takes, so text lands on a text box and never on a picture. `kindTraits` in `packages/document/src/traits.ts` is the one table of the traits each kind takes, and `takes` in `packages/document/src/element-takes.ts` turns it into the live fields an element takes (`removable` says which a person may delete); `decide`, `elementRefusal`, the MCP edit and delete tools and the export in `apps/web/src/exported-parts.ts` all read it. The replay checks that the code's table agrees with the model's `Takes` (`takenByKind`) and that `Type` on a picture is refused (`packages/engine/src/call.picture.test.ts` too). A drawn rectangle or ellipse holds no text body, so the replay checks that its `Type` is refused `kind` and leaves its typed states unreached. Every other kind and edit is tested in `packages/document/src/element-takes.test.ts`, not modelled.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## index

The import index: the browser's page queue, the server's stored pages, and the one layout upgrade.

- `OnlyEditsChangeRevision`: storing or replaying an index page never changes the deck revision. Harm: an agent's read goes stale for no edit.
- `AcknowledgedIsStored`, `PagesStayOrdered`: the browser counts a page as sent only after the server stored it, in order.
- `UpgradeReachesServer`: once the upgraded queue is acknowledged, the server holds the layouts. Harm: the browser marks the deck layered while the server has no layouts, and agents cannot add a slide from them.

Bounds: two pages, one crash, one edit, one upgrade. Run: `pnpm check:specs index`. Replay: `tests/index-replay.ts` drives `Store` and `Edit` through `indexDeck` and `readDeckPage`, with layouts on pages from the upgraded queue. Code: `indexDeck` in `packages/engine/src/index-deck.ts`, `appendIndex` in `packages/document/src/deck-index.ts`, `keepIndex` and `sendIndex` in `packages/live/src/deck-index.ts`. `Ack` advances the count only if the queue slot still holds the queue its send loop read (`swapSlot` with the queue's `once`); an answer to a page sent before an upgrade leaves the new queue alone, and the loop reads it again. The slot is found under the signed-in account's key (`scoped` in `packages/live/src/device.ts`), and the read and the write are one readwrite transaction on the page's long-lived connection (`putSlots` in `packages/live/src/store.ts`). `Ack` needs the page in flight to have landed (`landed`), since the browser hears back only after the server stored it. Leaves out: the browser queue steps are not replayed against `packages/live`, except the lost upgrade in `packages/live/src/deck-index-upgrade.test.ts`.

Sync: `8eef931306bc47b21b66b33dc5d7dc14634b9f4f`.

## sections

A deck's PowerPoint sections carried through the slide command log by `foldSections` in `packages/document/src/section-order.ts`, which the slide list and export (`packages/pptx/src/slide-order-route.ts`) both read.

This is a pure function of the log, with no concurrency, so it has no TLA+ model. A property test runs the real code on generated logs of add, duplicate, move, delete and restore over two sections: `packages/document/src/section-order.property.test.ts`.

- Every present slide is in exactly one section, the sections are runs in slide order, and every section name is kept, an emptied one included. Harm if broken: export drops a section name or lists a slide twice.
- A person's undo of an add, a duplicate, a move, a delete or a restore gives back the sections from before it. A move back to a key the slide held before takes the section it had at that key, so Run Undo of a move does the same.

Bounds: four slides in two sections split anywhere, logs of up to six commands, 300 runs each. Run: `pnpm vitest run packages/document/src/section-order.property.test.ts`. Code: `foldSections`, `slideUndoable` and `undoOf`. Leaves out: three or more sections, and export's own writing of the section list, which `pnpm check:pptx` judges.

Sync: `c757fd3d4819dabeb077254205e44a7214da780b`.
