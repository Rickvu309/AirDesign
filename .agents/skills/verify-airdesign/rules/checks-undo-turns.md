# Checks on the turn an undo leaves on a layer it leaves in place

The entry has the same parts as those in [checks-doom.md](checks-doom.md). [checks-undo-frames.md](checks-undo-frames.md) holds the deleted frames it builds on, and [checks-undo-steps.md](checks-undo-steps.md) the stray move (undo-strays).

## undo-turns

The turn an undo leaves on a card it does not put back into its old frame. The slide holds frame P, turned 30°, with the card K in it, and frame Q, turned 15°, which holds frame H. The person, or an agent run, moves K into H in one edit:

- the person's move keeps K's turn on the slide and turns H by 15° in the same edit, or turns K by 15° more;
- the run keeps K's turn in its frame, as the agent's `move` does, so K turns on the slide by the difference between the frames.

After a person's move, an agent run may move K from H onto the slide, keeping its turn in its frame. Another tab may turn H or Q once, and delete P or Q once before the first press. Then the person presses Ctrl+Z, Ctrl+Y or Undo on a run, twice at most.

Where the press leaves K where it sits, because its old frame is deleted or under a deleted frame, or because K has left the frame the step left it in (`strayedFrom`), K's turn on the slide becomes its turn now minus the step's own change of it: K's turn on the slide as the step left it against before the step (`turnsLeftInPlace` in `packages/doom/src/standing-layers.ts`). The press sets K's turn in its frame for the frames as the press leaves them, so a turn of H the press puts back does not turn K twice.

Figma has no undo across tabs to copy here. In Figma, another person's turn of a frame carries what it holds, and an undo of a step never takes that turn back. This model holds AirDesign to the same rule for a layer the undo leaves in place.

- `PutsBackWhereSeen`: a press that writes the turn of a K it leaves where it sits takes off only the step's own change of K's turn on the slide, so K ends at the turn the person saw before the step plus every turn others gave it since. Harm if broken: Aira moves and turns a card out of a frame, the person deletes that frame, and Undo on the run leaves the card turned as Aira left it (verdict 1514-d30cef9, finding 2).
- `NeverCoversTheirs`: such a press never takes another writer's turn off K. K ends at the turn the person saw plus theirs, or keeps its turn in its frame. The press never writes H's turn when another writer wrote it last. Harm if broken: the person ungroups K into frame F, another tab turns F to 38° and deletes it, and after both Ctrl+Z presses K sits at 60° in F at 38° and no longer turns with their frame (verdict 1532-759e007, finding 1).
- `NeverStuck`: every press takes its step off, so the next press reaches the step below it.
- The replay reads K's frame and turn, the turns of H and Q, which frames are deleted, and what the press answered, at every edge, from the real device deck. It also checks that the server holds what the tab shows. A run's `left` answer reads as nothing to undo.

Bounds: one move, one agent move, one turn and one delete by the other tab, and two presses. 484 states. Run: `pnpm check:specs undo-turns`. Replay: `tests/undo-turns-replay.test.ts` drives all 489 edges through the real `createDoomDeck`, `openDoomDeck` and `memoryDoomRemote`. Each run is sent to the server as an agent, reaches the device live, and is taken back with `undoRun`. `packages/doom/src/standing-layers.test.ts`, `packages/doom/src/invert-run.test.ts` and `packages/live/src/doom-undo-left-in-place.test.ts` hold the cases beside it. The last of these is verdict 1532-cfcc610's Aira repro: Undo on a run, then two Ctrl+Z presses.

Known gaps:

- After a reload the device does not hold the deck a run started on, so Undo on the run keeps the layer's turn, as `main` did. `invert-run.test.ts` pins this.
- When the press puts K's box back whole, because K sits where the step left it, K gets the turn it had in its frame. If the step also turned K's frame and another writer turned that frame since, the press cannot write the frame, so K keeps the step's turn of the frame on the slide. This is unchanged from `main`.
- A frame deleted before the step counts as unturned above it. A frame deleted after the step counts where it stood, when the press puts it back.

Leaves out: deeper frames, flips and line ends (`standing-layers.test.ts`), a third press, and a person's own later move.

Planted faults, each put in the model and then in the code. TLC numbers are from one worker.

| Fault                                                               | TLC on the planted model                                                                                                                                                                                                                                                                                                       | Replay on the planted code (489 edges)                                           |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `main`: K keeps its turn in its frame                               | 40 states, `PutsBackWhereSeen`: the person turns K 15° as they move it into H, the other tab deletes P, and Ctrl+Z answers nothing, so K keeps the step's 15°                                                                                                                                                                  | `standing-layers.ts`, `invert.ts` and `invert-run.ts` as on `main`: 108 disagree |
| 759e007: the turn rebuilt from the frames as they stand at the undo | 106 states, `NeverCoversTheirs`: the person turns K as they move it into H, the other tab turns H and deletes P, and Ctrl+Z writes K 0° in H, which takes their 15° off it                                                                                                                                                     | as on 759e007: 67 disagree                                                       |
| cfcc610: the turn rebuilt from the frames the step left K in        | 131 states, `PutsBackWhereSeen`: a run moves K into H, the other tab turns H and deletes P, and Undo on the run keeps the run's own turn. Checked on the person's presses alone, it fails in 211 states: Aira moves K onto the slide, Q is deleted, Undo on the run, then Ctrl+Z turns K 15° away from where the person saw it | as on cfcc610: 27 disagree                                                       |

Sync: `specs/undo-turns/covers.json`.
