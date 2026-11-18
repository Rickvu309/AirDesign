# Checks on stored grid rows

`Grid` checks six opening slides, same-row and below-row additions, a duplicate, source-head movement, deletion and restoration, guarded undo and redo, and device adoption. Its below-add paths include a foreign source-tail append, two below-adds, a deleted anchor, a colliding birth, foreign content in the added row and an unsafe redo after another tail append. It has 156 reachable states.

`Partition`, `NoEmptyRow`, `HeadsUniqueOrdered` and `RowMajor` require each live slide to belong to exactly one nonempty row, with live unique heads in presentation order. `ForeignRowKept` prevents a restored head or below-add taking a foreign slide from its row. `BelowSingleton` requires each accepted below-add to create its own row. `SameAcceptedPrefix` requires server and device projections to agree when they hold the same accepted prefix.

Run `pnpm check:specs grid`. `tests/grid-replay.test.ts` drives all edges through `decide`, `slideUndoable`, `undoOf`, `readSlideState` and `gridRows`. Adoption in this replay uses the structural decoder and joint fold; IndexedDB envelopes and once delivery are covered separately by the live format tests and the lost-answer and tabs replays.

The model uses six opening ids and two additional ids. It abstracts fractional keys to relative positions and checks these bounded lifecycle paths, rather than arbitrary permutations or all foreign interference. `grid-order.property.test.ts` generates 300 longer traces through real keys, including new-row additions, checks partition and decoding, and reverses each accepted edit. `grid-order.test.ts` covers initialization, head transfer, two tabs and guarded inverse interference. `grid-add.test.ts` checks application-time tail resolution, section inheritance, the 49-to-50 transition and atomic refusal at 50. `packages/live/src/grid-add.test.ts` covers offline reload, accepted-prefix replay, byte-identical sealed resends after a lost answer and an offline add followed by undo. Atomic group moves in same/new/keep placement, source-row removal, guarded whole-row undo/redo, stale membership refusal and independent foreign-gap insertion are modelled and replayed. Split and join remain outside the model and API. `grid-move.test.ts` and the generated traces cover plural moves with real fractional keys; live tests cover reload, journal recovery and lost answers.

A planted stale-anchor implementation failed the concurrent-tail unit case. A planted model that put the new head before the foreign tail slide violated `ForeignRowKept`. Both faults were removed before the passing run.

Person-undo continues to describe node-field interference; Grid covers its new structural spot/head branch. Slide-undo continues to describe run fencing and all-or-none run undo. Offline describes the node queue. Tabs and lost-answer retain their transport bounds; lost-answer now sends a tagged anchored add.

Sync: `specs/grid/covers.json`.

The plural extension retains exact row membership only for keep, and guards all moved spots and the existing head/neighbor dependencies for group moves. Grid abstracts server and device adoption; once-only delivery remains in live tests.

The extension was challenged by removing the complete-row refusal: the Grid replay failed on `RefuseStaleRow` because the code applied a move instead of refusing it. The fault was removed. TLC also checked the eight invariants afresh through the statechart runner: 125 states and 164 steps.

The selected-slide paths model deletion across row heads, duplication after the last selected slide, one guarded Undo for each edit, refusal of an empty deck, and refusal of a colliding copy id. The replay reaches each path through the document commands. The document test checks the actual 50-slide limit, and the live tests exercise offline replay and a byte-identical resend for both commands.

The versioned paths publish section starts, pack three complete singleton sections together and choose the opening partition from the first command's version, and replay a later command from the other version. `VersionedDefault` checks the resulting heads. `grid-version.test.ts` in document also replays a recorded version-one log with and without the upgraded index, and generates section lengths to check complete-section packing, wrapping and the frozen unsectioned default. The live test recovers the version-two edit from its journal and sends a new import's index before its first edit.

The device saves section starts in a format-stamped slot and reads it in the same transaction as the edit rows. The live version test checks that a fresh import has an empty edit log and can still recover a version-two edit offline.
