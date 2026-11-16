# Structure check

Same fields as [checks-document.md](checks-document.md). The replay runs with the others: `pnpm vitest run tests/spec-replay.test.ts`.

## structure

Adding and removing an element, a run's read of the element list, and grouping and ungrouping elements.

- `StructuralRecord`: an add or remove changes only the named element.
- `ReadSetHeld`: a read keeps the element list it saw.
- `AbsentEditLeavesCounts`: an edit naming an absent element changes no counts.
- `ChildrenKeepPlace`: a child of a group shows where the person last saw it through group, a move of the group, ungroup, the person's Undo and Redo of each, and a run's Undo of a group the agent made.
- `RunUndoTurnsBackGroup`: a run's Undo of a group the agent made leaves it ungrouped for good.
- `PersonMoveKeepsAgentGroup`: a run's Undo refuses to ungroup the agent's group once the person moved it, or once a child's own rows no longer match where the group command placed it.

Bounds: two elements, `a` always present; one group with one child the model follows, moved by at most one step, the child moved by at most one step on the slide. The group sub-model runs from one quiet start (no record, no read, idle run `s`), and the node actions run only while no group exists, so the two parts share no states. Run: `pnpm check:specs structure`. Replay: `tests/structure-replay.ts`. `replayNodes` drives `decide` `add`, `remove` and `read`; `replayTree` reaches every group state from the quiet start through the code (`groupOf`, `ungroupTurn`, `element-regroup` through `decide`, person box rows on the group and the child, `undoSlides`) and checks each edge's shown place (`placeOf`, through `throughGroup` while grouped), `groupFormed` and `groupedNow`. Code: `packages/document/src/element-group.ts` (refusals, the folded group tree), `group-place.ts`, `group-turn.ts`, the group branch of `slideUndoable`, `turn` and `turnCommands` (a person's Undo and Redo of a group) and of `undoSlides` with `groupUndone` (a run's Undo of a group, and the refusal `PersonMoveKeepsAgentGroup` checks) in `person-undo.ts`. Leaves out: product code adds a register with `add` (`openedRegister` in `call.ts`, `opened` in `packages/live/src/cache.ts`) and uses `remove` only to put a restored register back (`decideOnElement`). `read` has no product caller. A person's element add and remove go through slide commands, covered by element. Rotation, flips and scale of a group are not modelled; `throughGroup` is tested against the painter in `packages/document/src/element-group.test.ts` and against the export in `packages/pptx/src/group-route.test.ts`. The export's replay of group commands (`groupsReplayed` in `packages/pptx/src/group-route.ts`) is tested there, not modelled. An agent's own move of its group, then a person's ungroup and Undo of it, is refused by `rowsKept` and tested in `element-group.test.ts`.

Sync: `specs/structure/covers.json`.
