# Checks on the edit register and slides

Each entry: what the check promises, the code it covers, its bounds, how to run it alone, its replay, what it leaves out, and its sync: the `covers.json` that records the code the model was last confirmed against, or for sections, the commit. Replays live in `tests/spec-replay.test.ts` and the `tests/*-replay.ts` files it calls. Run them with `pnpm vitest run tests/spec-replay.test.ts`.

The register code is `packages/document/src/decide.ts`: `decide` and, per element, `personEdit`, `startRun`, `agentEdit`, `stopRun`, `decideUndo`, `version`. No product path calls it: the editor and the agent tools write Doom decks, which [checks-doom.md](checks-doom.md) checks. Its callers are these replays, the register cases of `pnpm check:pptx` (`scripts/pptx-cases/`) and unit tests. Text and box rows share one register per element, so "one property" in a model means one element's register.

## edit

One run edits one element while a person edits it too.

- `PersonAlwaysLands`: a person's edit to a present element is never refused. Harm if broken: a person's typing is lost.
- `AgentSawCurrent`: every agent row was written on the version it read, or on its own run's claim. Harm: an agent overwrites text it never saw.
- `ProtectedFromRun` and `GuardedRunRefusesAsProtected`: once a person edits during a run, no later agent row of that run lands, and the refusal is `person-protected` whatever the read. Harm: the agent writes over a person mid-edit.
- `GuardedOnlyByAPersonEdit`: a run is guarded only by a person's own edit. `DeviceMeasures`, the device writing the size it measured from the text as a person row that sets only `box.h`, or `box.w` and `box.h` (`measuredOnly` in `packages/document/src/measured-row.ts`), lands like a person write but guards nothing. Harm if broken: after the open tab measures a frame child or text that hugs its text the agent just edited, the agent's next edit of it is refused `person-protected`.
- `StopFences`: after Stop, no agent row of that run lands. Harm: a stopped agent keeps writing.
- `UndoRevertsOnlyTheRun`: run Undo hides only that run's rows and keeps every person edit. Harm: Undo erases a person's work.

Bounds: one element, one run, two agent rows, one person edit before and one after the run's first row. Assumes the element and its slide are present and its kind takes the edit: `takenRefusal`, the first check in `decide`, refuses a box edit on a grouped element `group-box` and any other edit its kind cannot take `kind`, before this model starts. Group and ungroup change which elements are grouped, so once a group command takes in an element, a box edit of it is refused this way too; structure models grouping. Run: `pnpm check:specs edit`. Replay: `replayEdit` drives every edge through `decide`. Edit, undo and run replays land later agent rows as trait field rows (`set`).

Sync: `specs/edit/covers.json`.

## undo

Undo of a run hides only that run's rows.

- `UndoKeepsPerson`, `PersonRowsStay`: undo leaves every person row. Harm: Undo erases a person's work.
- `EarlierUndoKeepsLater`, `SecondUndoRemovesNothing`: undo of an earlier run never hides a later run's row, and a second undo hides nothing more.
- `LiveRunKeepsEarlier`: while a later run is live, undo of the earlier run is refused and its row stays.
- `CompactKeepsHead`, `HorizonIsGiven`: compaction drops a hidden row only after a horizon, and keeps the person row.
- `VersionNeverReused`: the version never falls, and each change to what the element shows raises it. Harm: a client trusts a stale version and drops an edit.

Bounds: one element, one person row, two runs with one row each. Run: `pnpm check:specs undo`. Replay: `replayUndo` through `decide`, `decideUndo` and `compactChain`. Leaves out: `compactChain` has no product caller, so the compaction half verifies library code nothing runs. Run Undo of slide rows goes through `undoSlides` in `packages/document/src/person-undo.ts`, outside this model.

Sync: `specs/undo/covers.json`.

## rerun

Two runs on one element in turn: the guard, the claim and the stop mark of each.

- `SecondRunStaysProtected`, `GuardedRunRefusesAsProtected`: a person edit during the second run fences that run.
- `NewRunNeverContinuesOldClaim`, `GuardBelongsToThisRun`: a new run starts with no claim and no guard from the old run. Harm: a new run writes on an old run's read, or is blocked by an old guard.
- `StopFences`: a stopped run lands nothing, and a live run has no stop mark.
- `SecondUndoKeepsOtherRows`: undo of the second run keeps the first run's row and person rows.
- `VersionNeverReused`: as in undo.

Bounds: one element, two runs, the second starting from a stopped or undone first. Run: `pnpm check:specs rerun`. Replay: `replayRerun` through `decide`.

Sync: `specs/rerun/covers.json`.

## run

A run's lifecycle: start, stop, undo, a later run, and reads.

- `StartRefusedWhileLive`, `LaterStartUsesAFreshId`: no start replaces a live run, and a later run never reuses an id that owns a row.
- `StopFreezesLandedWrites`, `StoppedOrEndedRejectsWrite`: a stopped run's visible rows never grow, and an undone run shows none of its rows.
- `UndoLeavesTheOtherRun`, `EarlierUndoWaitsForEnd`: undo leaves another run's row, and undo of an earlier run waits for the live run to end.
- `ReadMatchesStoredRun`, `UnstartedHasNoWrites`, `ResumeContinuesSameRun`, `LimitEndsLikeStop`.

Bounds: one element, run ids `s` and `t`, one write, two generations. Run: `pnpm check:specs run`. Replay: `replayRun` through `decide`. Leaves out: `Limit` and `Resume` have no code; the replay counts them as unconnected. The `read` command (`readNodes`) has no caller outside the replay.

Sync: `specs/run/covers.json`.

## sections

A deck's PowerPoint sections carried through the slide command log by `foldSections` in `packages/document/src/section-order.ts`. It folds through `sectionRuns`, which `foldGrid` and the export (`packages/pptx/src/slide-order-route.ts`) read too.

This is a pure function of the log, with no concurrency, so it has no TLA+ model. A property test runs the real code on generated logs of add, duplicate, move, delete and restore over two sections: `packages/document/src/section-order.property.test.ts`.

- Every present slide is in exactly one section, the sections are runs in slide order, and every section name is kept, an emptied one included. Harm if broken: export drops a section name or lists a slide twice.
- A person's undo of an add, a duplicate, a move, a delete or a restore gives back the sections from before it. A move back to a key the slide held before takes the section it had at that key, so Run Undo of a move does the same.

Bounds: four slides in two sections split anywhere, logs of up to six commands, 300 runs each. Run: `pnpm vitest run packages/document/src/section-order.property.test.ts`. Code: `foldSections`, `slideUndoable` and `undoOf`. Leaves out: three or more sections, and export's own writing of the section list, which `pnpm check:pptx` judges.

Sync: `c757fd3d4819dabeb077254205e44a7214da780b`.
