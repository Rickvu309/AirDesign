# Check on a person's own Undo and Redo

Same fields as [checks-document.md](checks-document.md). person-undo is replayed in `tests/spec-replay.test.ts` and `tests/photo-undo-replay.test.ts`. A run's own Undo is undo in [checks-document.md](checks-document.md). This is the register's undo, which no product path calls; a person's Undo on a Doom deck is doom in [checks-doom.md](checks-doom.md).

## person-undo

A person's Undo and Redo of one step that edited the text of two elements, A and B, beside an agent run that writes A's text or moves A's box.

- `UndoShowsBefore`: an undo or redo shows exactly the text it went back to, on every element of the step.
- `NeverCoversAgent`, `AgentRowStays`: a person's undo never lands over an agent row that shows on a field the undo names, and only the run's own Undo hides that row. Harm: a person's Ctrl+Z erases Aira's work.
- `UndoKeepsOtherFields`: a field the step does not name keeps what showed, so the person's text undo lands while Aira's move of the same element shows, and leaves the move. Harm: Ctrl+Z on a text puts back a box an agent moved, or refuses because of it.
- `StepTurnsWhole`: a step lands on every element it names or on none. Harm: Ctrl+Z after one change to two titles turns back one of them.
- `DroppedIsTold`: an undo that changed nothing is always told.

Bounds: up to four person steps, each one row on each element, one agent row on A's text or A's box, 185 states. Run: `pnpm check:specs person-undo`. Replay: `tests/person-undo-replay.ts` through `undoOf`, `redoOf` and `decide` on a `{ steps }` undoable, with the step's elements on different slides in the order B then A; on every Undo and Redo edge the step of A alone must agree with the two-element step. The model takes a step as given: how a step is built and merged is outside it. Code: `undoOf`, `redoOf`, `turn` and `turnCommands` in `packages/document/src/person-undo.ts`, which land a step on all its elements or none through `stepCommands` and `applying`, compare each field a step names with `shows` over `shownPatch` (`packages/document/src/decide.ts`, the node's floor and its visible rows folded per trait field by `netPatch`), read a format 1 value as the trait the step names (`holderOf`, so a notes step turns on a device register that holds no index), and write the step back as format 1 values with `formatOne` (`packages/document/src/row.ts`) when every field it names has one, and as one row `{ v, patch }` otherwise, such as a fill or a field back to `"opening"` (`person-undo.test.ts`). Leaves out: box undo, slide undo (`slideUndoable`), stacking (`element-order` and the stack branch of `turn`), and notes edits, which take the same path as text.

Sync: `specs/person-undo/covers.json`.
