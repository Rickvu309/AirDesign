# Add a text layer and delete a layer

In an open deck the Text tool (T, or `Text` in the toolbar) places a text layer where the person clicks, with the caret in it, ready to type; a drag draws a fixed-width box instead. A selected layer is deleted with Delete or Backspace. Both paint at once, can be undone, reach the server as Doom writes, and survive a reload. Aira and an outside agent add and delete layers through `airdesign_edit_deck`, which lands the same writes.

## Sub-features

- `text-place` T arms the Text tool (`button "Text"` is pressed). A click places a text layer at the click that grows with its words (`resize: "widthAndHeight"`); a drag draws a box of that width that wraps them (`resize: "fixed"`). The tool goes back to Move. Escape with no words typed leaves no layer behind.
- `text-type` typing writes the text's `chars` and `spans`; Ctrl/Cmd+B and the other text keys format the selected words while typing. Escape ends the edit and keeps the layer selected.
- `text-edit` a double-click on a text layer edits it where it was clicked; Enter on a selected text layer edits it with all its words selected. A double-click on a shape with no words starts words inside it and makes no new layer.
- `emptied-text` a text layer whose words are all deleted is removed when the edit ends, and one undo brings it back with its words. A shape left with no words stays.
- `delete` Delete or Backspace on a selected layer, outside its text, removes it with what it holds: the node's `parent` becomes `null` on the server (`deleteWrites` in `apps/web/src/editor/delete-writes.ts`). While the caret is in the text, the keys edit the text. One undo brings the layer back.
- `agent` `airdesign_edit_deck` with `{ op: "add", kind: "text", slide, text }` adds a text layer and `{ op: "delete", nodes: [...] }` deletes layers (`AgentChange` in `packages/doom/src/agent-change.ts`); Undo under Aira's reply takes Aira's run back, and `airdesign_undo_run` takes back any agent's (see `aira-panel.md`).

## How to get to it (user POV)

- An open deck `/s/<id>`: `Text` in the toolbar under the slide, or T, then a click or a drag on the slide.
- Click a layer, press Escape if its text is being edited, then Delete.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-text.spec.ts`: the Text tool places a layer, typing and Ctrl+B write it, Escape keeps it through a reload; a drag draws a fixed box and an empty one leaves no layer; a double-click edits where it was clicked, Enter edits with all selected, and emptying removes it in one undo; a double-click on a shape starts words inside it. `tests/browser/editor.spec.ts` deletes the title, polls `doomRoutes.open` for its `parent: null`, and undoes.
- **States for look.** `text-tool-placed`, `text-typed-at-once` (typing under CPU throttle 4 keeps every letter), `text-placed-while-storing`, `element-added`, `element-deleted`, `elements-deleted`, `group-deleted`, `empty-text-left`, `emptied-text-left`, `shape-typed`, `shape-text-area`.

## Gotchas

- Delete inside the text deletes characters. Press Escape first so the layer, not the text, has focus.
- The text being edited is `[data-text-editor]`; count painted layers inside `[data-slide-box]`, since the slide strip's thumbnails paint them too.
- Wait for `[data-text-editor]` to be focused before typing into a new layer.
