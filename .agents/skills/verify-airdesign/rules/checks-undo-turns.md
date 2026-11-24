# Checks on the turn an undo leaves on a layer it leaves in place

The entry has the same parts as those in [checks-doom.md](checks-doom.md). [checks-undo-frames.md](checks-undo-frames.md) holds the deleted frames it builds on.

## undo-turns

The turn an undo leaves on a card it leaves in its new frame, beside another tab's turn of that frame. The slide holds frame P, turned 30°, with the card K in it, and frame H. A person or an agent run moves K into H in one edit. The edit keeps K's turn on the slide, may turn K by 15° more, as an agent's own `rotation` can, and may turn H by 15° in the same edit. Another tab may turn H by 15° once, before or after the step, and may delete P once the step landed. Then the person presses Ctrl+Z, or Undo on the run, once. While P stands, the undo puts K back into P. Otherwise it leaves K in H at the turn K has there (`boxLeftInPlace` in `packages/doom/src/standing-layers.ts`). It writes H's turn back only while the step wrote it last.

Figma has no undo across tabs to copy here: in Figma, another person's turn of a frame carries what it holds, and an undo of a step never takes that turn back. This model holds AirDesign to the same rule for a layer the undo leaves in place.

- `NeverCoversTheirs`: once another tab turned H after the step, a K left in H ends at the turn the person saw plus theirs, or stays as it is, which carries theirs. It never gets a counter-turn that takes their turn off K, and the undo never writes H's turn when they wrote it last. Harm if broken: the person ungroups K into turned frame F, another tab turns F to 38° and deletes it, and after both Ctrl+Z presses K sits at 60° in F at 38°, no longer turning with their frame (verdict 1532-759e007, finding 1).
- The replay reads, at every edge, K's frame and turn, H's turn, whether P is deleted and what the press answered from the real device deck, and that the server holds what the tab shows. A run's `left` answer reads as nothing to undo.

Bounds: one step, one turn and one delete by the other tab, one press. 98 states. Run: `pnpm check:specs undo-turns`. Replay: `tests/undo-turns-replay.test.ts` drives all 105 edges through the real `createDoomDeck`, `openDoomDeck` and `memoryDoomRemote`, with the run's edit sent to the server as an agent and taken back with `undoRun`. `packages/doom/src/standing-layers.test.ts` and `packages/live/src/doom-undo-left-in-place.test.ts` hold the cases beside it: framing (Ctrl+Alt+G) in two tabs, a re-measured turn, and Undo on a run followed by Ctrl+Z.

Known gap: a turn the step itself gave K, such as an agent's own `rotation`, stays after the undo (verdict 1514-d30cef9, finding 2). The model keeps it, as the code does, so the replay pins today's turn. Rebuilding the turn from the old and new frames failed twice (verdicts 1532-759e007 and 1532-cfcc610). A fix takes the step's own change of turn off the turn K has now, and changes this model with it.

Leaves out: frames above P and H; a redo; flips and line ends (`standing-layers.test.ts`); more than one press (undo-deleted-frames).

Planted faults, each put in the model and then in the code:

| Fault                                                                | TLC on the planted model                                                                                                                               | Replay on the planted code                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 759e007: K turned against H as H stands once the undo lands          | 83 states, `NeverCoversTheirs`: the person moves K into H, the other tab turns H and deletes P, Ctrl+Z writes K 15° in H, which takes their 15° off it | `standing-layers.ts`, `invert.ts` and `invert-run.ts` as on 759e007: 16 of 105 edges disagree  |
| The undo writes H's turn back though the other tab wrote it last     | 56 states, `NeverCoversTheirs`: the step turns H, the other tab turns it again, Ctrl+Z puts the step's value back over theirs                          | (ownership is judged in `invert`, covered by undo-steps)                                       |
| cfcc610: the step's own turn taken off K, H read as the step left it | (passes: it keeps theirs)                                                                                                                              | as on cfcc610: 10 of 105 edges disagree, each a press that takes back the step's own turn of K |

Sync: `specs/undo-turns/covers.json`.
