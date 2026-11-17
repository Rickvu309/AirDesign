# Checks on stored grid rows

`Grid` checks six opening slides, same-row and below-row additions, a duplicate, source-head movement, deletion and restoration, guarded undo and redo, and device adoption. Its below-add paths include a foreign source-tail append, two below-adds, a deleted anchor, a colliding birth, foreign content in the added row and an unsafe redo after another tail append. It has 88 reachable states and 116 edges.

`Partition`, `NoEmptyRow`, `HeadsUniqueOrdered` and `RowMajor` require each live slide to belong to exactly one nonempty row, with live unique heads in presentation order. `ForeignRowKept` prevents a restored head or below-add taking a foreign slide from its row. `BelowSingleton` requires each accepted below-add to create its own row. `SameAcceptedPrefix` requires server and device projections to agree when they hold the same accepted prefix.

Run `pnpm check:specs grid`. `tests/grid-replay.test.ts` drives all edges through `decide`, `slideUndoable`, `undoOf`, `readSlideState` and `gridRows`. Adoption in this replay uses the structural decoder and joint fold; IndexedDB envelopes and once delivery are covered separately by the live format tests and the lost-answer and tabs replays.

The model uses six opening ids and two additional ids. It abstracts fractional keys to relative positions and checks these bounded lifecycle paths, rather than arbitrary permutations or all foreign interference. `grid-order.property.test.ts` generates 300 longer traces through real keys, including new-row additions, checks partition and decoding, and reverses each accepted edit. `grid-order.test.ts` covers initialization, head transfer, two tabs and guarded inverse interference. `grid-add.test.ts` checks application-time tail resolution, section inheritance, the 49-to-50 transition and atomic refusal at 50. `packages/live/src/grid-add.test.ts` covers offline reload, accepted-prefix replay, byte-identical sealed resends after a lost answer and an offline add followed by undo. New-row move, split, join and plural-move capabilities remain outside the model and API.

A planted stale-anchor implementation failed the concurrent-tail unit case. A planted model that put the new head before the foreign tail slide violated `ForeignRowKept`. Both faults were removed before the passing run.

Person-undo continues to describe node-field interference; Grid covers its new structural spot/head branch. Slide-undo continues to describe run fencing and all-or-none run undo. Offline describes the node queue. Tabs and lost-answer retain their transport bounds; lost-answer now sends a tagged anchored add.

Sync: `specs/grid/covers.json`.
