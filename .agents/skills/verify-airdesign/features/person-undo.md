# Undo and redo the person's edits

The person's own edits in an open deck can be undone and redone from the keyboard: moves, resizes, turns, flips, typing and text formats, added, pasted and deleted layers, groups, arrangement, Design panel changes, speaker notes and slide changes. Ctrl/Cmd+Z undoes, and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Each step puts back the props it wrote and lands on the server like any edit. An undo leaves alone a prop someone else, such as an agent, changed since, and puts back the rest.

## Sub-features

- `undo-keys` Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y reach the deck's undo from anywhere in the editor outside a form field (`useCanvasKeys` in `apps/web/src/doom-editor/use-canvas-keys.ts`). Form fields (`input`, `textarea`, `select`) keep the browser's own undo, so in the speaker notes field the keys undo the browser's typing.
- `undo-steps` each edit the editor pushes is one step: one gesture, one key, one panel change. Undo writes back each prop's value from before the step and redo the step's own values; an undo of an add deletes the layer and its redo puts it back; a new edit forgets the redo steps (`packages/live/src/doom-deck.ts`, cases in `doom-deck.test.ts` and `doom-undo-chain.test.ts`).
- `undo-typing` Ctrl/Cmd+Z while typing ends the edit and takes back the words typed since the text last saved (`use-text-session.ts`).
- `undo-paint` an undone move paints the layer back at once and the server gets its box; an undone text edit repaints the slide at once.
- `undo-other-writer` an undo leaves alone a prop another writer changed after the step and puts back the others. When every prop was overwritten since, there is nothing to undo.
- `undo-run` an agent's run is undone as a whole from the Agent panel, not by Ctrl/Cmd+Z (see `aira-panel.md`); it leaves what the person wrote after the run.

## How to get to it (user POV)

- An open deck `/s/<id>`: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, on the canvas or in a text being edited.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/doom-editor.spec.ts` undoes and redoes a nudge, read from `doomRoutes.open`, and undoes a delete. `tests/browser/doom-editor-transform.spec.ts` undoes two resizes one step each. `tests/browser/doom-editor-text.spec.ts` undoes an emptied text and typing while editing. `tests/browser/doom-arrange.spec.ts` undoes an ungroup and a frame. `tests/browser/doom-editor-picture.spec.ts` undoes and redoes a dropped picture. `tests/browser/doom-agent-undo-reload.spec.ts` undoes an agent's run after a reload.
- **Unit tests.** `packages/live/src/doom-deck.test.ts`, `doom-undo-chain.test.ts` and `doom-undo-run.test.ts`; `tests/doom-replay.test.ts` drives a person's step, undo and redo against an agent's run through the Doom core.
- **States for look.** `text-undone`, `text-undone-in-box`, `three-undone`, `notes-then-text-undone`, `frame-text-undone`.

## Gotchas

- Press Escape after typing to give the canvas the keys when the next key should act on the layer, such as Delete or an arrow.
- Wait for the screen to show the undo before you reload: the undo paints first and lands on the server after.
