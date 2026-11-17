# Checks on stored grid rows

`Grid` checks six opening slides, one add or duplicate, a source-head move, head deletion followed by a refused undo across a foreign gap insertion, a nonhead gap insertion and its successful undo, and singleton removal and restoration. Device adoption can happen between these steps. It has 41 reachable states and 52 edges.

`Partition`, `NoEmptyRow`, `HeadsUniqueOrdered` and `RowMajor` require each live slide to belong to exactly one nonempty row, with live unique heads in presentation order. `ForeignRowKept` prevents a restored head taking the foreign gap slide into its row. `SameAcceptedPrefix` requires server and device projections to agree when they hold the same accepted prefix.

Run `pnpm check:specs grid`. `tests/grid-replay.test.ts` drives all edges through `decide`, `slideUndoable`, `undoOf`, `readSlideState` and `gridRows`. Adoption in this replay uses the structural decoder and joint fold; IndexedDB envelopes and once delivery are covered separately by the live format tests and the lost-answer and tabs replays.

The model abstracts fractional keys to relative positions and checks these bounded lifecycle paths, rather than arbitrary permutations or all foreign interference. `grid-order.property.test.ts` generates 300 longer traces through the real keys, checks partition and decoding, and reverses each accepted edit. `grid-order.test.ts` covers initialization in mixed history, head transfer, the 50-slide refusal, two tabs, safe undo after a gap insertion and refusal after a changed successor. No later new-row, split, join or plural-move capability is modelled or advertised.

Person-undo continues to describe node-field interference; Grid covers its new structural spot/head branch. Slide-undo continues to describe run fencing and all-or-none run undo. Offline describes the node queue. Tabs and lost-answer retain their transport bounds; lost-answer now sends a tagged anchored add.

Sync: `specs/grid/covers.json`.
