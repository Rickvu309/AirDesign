# Checks on a connector's ends across tabs

The entry has the same parts as those in [checks-doom.md](checks-doom.md). [checks-undo-offline.md](checks-undo-offline.md) holds the queue and the resend of a refused turn it builds on.

Concurrent edits follow Figma: the last write wins property by property, and a delete wins, quietly. No line end ever makes the deck refuse a batch.

## line-ends

One connector's start and end beside the shape X its start may attach to. Tab A deletes X, undoes the delete or redoes it, and sends late: offline, or before it caught up. Tab B writes once, at any time: it moves X, attaches the start to X, or moves the line's end. A run starts either fresh, with the start on X or free, or with the delete and its undo landed, so the next press is a redo.

The rule (`packages/doom/src/line-ends.rule.md`) in three parts:

- The device frees every end its view shows on a shape the batch takes off the deck, at the point it painted, in a line write with no base, so it wins over what landed before it (`freeLineEnds` in `packages/doom/src/freed-line-ends.ts`).
- The deck frees any end still on a shape off the deck after the batch where the shape's stored box paints (`freedInFold` in `packages/doom/src/lost-ends.ts`, run by `landEdit`), so the delete lands even from a tab that never saw the attach.
- A refused undo or redo is sent again with each end the other tab left as the tab read it at the press, the other tab's end for the rest (`lineEndsBack`, the ownership rule of an undo online), and its ends freed again against the caught-up deck (`onStandingOnly` in `packages/live/src/turn-replay.ts`).

Properties:

- `NoDeadEnd`: an end on a shape names a shape on the deck. Harm if broken: a tab that never saw another tab attach the line deletes the shape, and the end paints from the deleted shape's box, out of its frame, on every tab and after reload (verdicts 1614-1fa3d87 finding 2, 1614-cfac37d).
- `DeletesWin` and `NeverSetAside`: every delete and redo A sends lands, and no edge sets an edit aside. Harm if broken: a delete from a tab that missed another tab's change is refused with a notice and the shape stays.
- `FreesWherePainted`: a freed end sits where X's right side painted at one of its boxes, on the server or in the deleting tab's view when it pressed. If the other tab moved X first, the end may land a few pixels from where that tab saw it; the owner accepts that.
- `RestoresAttachment`: the undo of a delete that freed the start in its own line write puts the start back on X. Harm if broken: an undo sent late, after the other tab moved only the line's other end, brings X back with the start left free (verdict 1614-1fa3d87 finding 1).
- `KeepsTheirEnd`: B's end stays unless a batch that takes X off the deck writes the whole line after it.
- The replay also reads, at every edge, what the tab shows and what the server holds and how many edits wait to send.

Bounds: one shape, one line, two tabs, one write by the other tab, a delete and one press, or one redo. 133 states. Run: `pnpm check:specs line-ends`. Replay: `tests/line-ends-replay.test.ts` drives all 174 edges from the three starts through the real `createDoomDeck`, `openDoomDeck` and `memoryDoomRemote`, the person's tab cut off from the server except for the edit a send step lets through, and another tab on the same server. `packages/live/src/doom-line-ends-tabs.test.ts` holds the same cases with a frame, `packages/doom/src/lost-ends.test.ts` the deck's freeing, a moved frame and the redo, and `apps/api/src/doom-deck-line-ends.test.ts` the server's partial fold.

Leaves out: frames in the model (`freedInFold` reads the shape's frames as the deck held them before the batch, and `lost-ends.test.ts` holds a moved frame); a removal and undo or redo queued together, and a turn rebuilt behind a resent one (`onStanding` frees the rebuilt turn again; `turn-replay-queued.test.ts` holds the order); agent runs, which take `edit_deck` and `undo_run` through the same `freeLineEnds` and `freedInFold`.

Known limits:

- The device's freed line write carries the whole line, so a delete from a tab that missed another tab's change to the line's other end writes over that end: the last write wins.
- An end the deck frees, not the device, is not in the delete, so undoing the delete leaves it free.
- The deck frees an end from the stored boxes of the shape's frames, not the solved auto layout, so a shape in an auto layout frame frees at its stored box when no device freed it. An undo after another tab deleted the shape frees at the target's raw box for the same reason (verdict 1623-560f87c finding 3).
- A reopened tab sends its queued undo or redo without the per-end ownership the press read (verdict 1623-c9afad7 finding 5).

The rule the code had before, as `Rule = "tabView"` (the device frees only what its view shows, the base names only the line's geometry, the deck keeps an end on a deleted shape, and a refused turn drops a line write another tab touched):

| Property             | TLC on `tabView`                                                          |
| -------------------- | ------------------------------------------------------------------------- |
| `NoDeadEnd`          | redo, the other tab moves the end, send                                   |
| `NeverSetAside`      | delete, the other tab moves the end, send                                 |
| `DeletesWin`         | delete, the other tab moves the end, send                                 |
| `RestoresAttachment` | delete, undo, send the delete, the other tab moves the end, send the undo |
| `FreesWherePainted`  | passes                                                                    |
| `KeepsTheirEnd`      | passes                                                                    |

Planted faults in the code, each seen to fail the replay: the deck never frees (11 of 174 edges disagree); the device's freed write keeps the base it read (10).

Sync: `specs/line-ends/covers.json`.

## line-end-batches

One batch at a time lands on the server, from an agent or a tab, beside two shapes a line's end may attach to: X, which a batch may take off the deck, and Y, which stays. A batch deletes X, moves X into a frame already off the deck, or leaves X alone. With it, it may create the line N, move the line L into another frame, or turn the plain shape M into a line by a geometry write alone, with the start on X, on Y or free. Or it deletes the frame F, or restores F with the line R inside it, whose start is on X until the deck frees it. Two batches from a start where L's start is on X, on Y or free. The model takes each batch as read from the deck it lands on; `line-ends` holds two tabs.

The rule:

- Every batch lands. The deck frees each end on a shape off the deck of a line the batch takes a shape from, writes a geometry or a parent to, or brings back onto the deck inside a frame (`deadLines`, `freedInFold` in `packages/doom/src/lost-ends.ts`).
- The server loads the lines that name every shape the batch deletes and the shapes those lines name (`partSql` in `apps/api/src/doom/doom-deck.ts`). When the folded batch takes another shape off the deck, or brings a subtree back, it reads again with that shape's lines or the subtree's lines (`leavingRoots`, `returningRoots`, `editDoom`), and saves every line the fold freed.

Properties:

- `NoDeadEnd`: no line on the deck names a shape off the deck. Harm if broken: a geometry write alone draws a line onto a deleted shape, or a restored frame brings back a line on a shape deleted meanwhile, and the stored end names the deleted shape (verdict 1623-560f87c findings 1 and 2).
- `PartialAgrees`: the server's partial fold leaves what the whole deck's fold leaves. Harm if broken: the server stores a dead end in a restored frame that a replay of the whole log frees.
- `NeverRefused` and `DeletesWin`: no batch is refused, and a batch that takes X off the deck leaves it off.

Bounds: two shapes, two frames off the deck or not, four lines, two batches. 461 states, 1,010 edges. Run: `pnpm check:specs line-end-batches`. Replay: `apps/api/src/testing/line-end-batches-replay.test.ts` seeds each edge's source state as a deck on Postgres, sends the batch through `editDoom`, and compares what the deck stores, whether the server landed it, and what `applyEdit` on the whole fold leaves with the target state.

Leaves out: two tabs (`line-ends`); free points, which the replay tests in `apps/api/src/doom-deck-line-ends.test.ts`; a geometry write that names a shape off the deck on a line that stays in its frame, which `keepLiveEnds` answers with the end the line holds; hidden shapes and shapes on other slides, which stay on the deck.

The rule before this check, as `Rule = "refuseChecked"` (the deck refuses a batch that writes a parent and leaves an end it checks on a shape off the deck, and checks no line a frame brings back):

| Property        | TLC on `refuseChecked`                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| `NoDeadEnd`     | X deleted, then a geometry write alone turns M into a line on X                             |
| `NoDeadEnd`     | F deleted with X, then F restored; or F deleted, then F restored as X is deleted or shelved |
| `NeverRefused`  | a batch deletes X and creates N with its start on X                                         |
| `DeletesWin`    | the same batch: X stays on the deck                                                         |
| `PartialAgrees` | passes                                                                                      |

With `freeEvery` and no second read for a subtree that comes back, `PartialAgrees` fails: F deleted with X, then F restored. Planted faults in the code, each seen to fail the replay: the server does not read again for a subtree that comes back (4 of 1,010 edges disagree); the deck frees only lines whose end named a removed shape or that the batch moves (72); the deck never frees (524).

Sync: `specs/line-end-batches/covers.json`.
