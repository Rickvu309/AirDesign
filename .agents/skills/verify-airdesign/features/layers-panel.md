# Pick, rename, reorder, hide and lock layers in the layers panel

In design mode the left sidebar shows Layers under the slide list: the current slide's layers, front first, with a group's or frame's layers nested under it. Hovering a row outlines that layer on the slide, a click selects it there, a double-click renames it, a drag moves it in the layer order, its eye hides it, and its padlock locks it. The slide and the filmstrip follow at once.

## Sub-features

- `layers-panel` the list, hover outline, click, Shift and Ctrl selection, rename by double-click, Enter or F2, and drag to reorder among siblings. A rename is the `identity.name` field; a reorder is the `element-order` row with the sibling it now sits before, the same row the arrange menu and an agent send. Undo takes either back.
- `layers-hidden` the row's eye and Ctrl+Shift+H hide or show the selection as the `identity.hidden` field. A hidden row is dimmed with its eye shut, and it can still be selected in the panel; the slide and the filmstrip stop painting it.
- `layers-locked` the row's padlock and Ctrl+Shift+L lock or unlock the selection as the `identity.locked` field, exported as PowerPoint's shape locks. A locked layer takes no pointer on the slide, so a click passes through it; it stays selectable in the panel.
- `layer-shortcuts` Ctrl+Alt+G (Cmd+Option+G) wraps the selection in a plain frame (`layout.flow = "none"`, no reflow) and adds Frame selection to the right-click menu; Cmd/Ctrl+R opens Design mode and focuses the selected layer's inline rename input without reloading the page (leaving reload alone when nothing is selected); `]` and `[` (and Mac Cmd+Option+]/[, Windows Ctrl+Shift+]/[) send to front/back and Cmd/Ctrl+]/[ move forward/backward on both the slide and focused layer rows.
- A frame's backdrop is not listed: it paints the frame's own fill.
- A drag onto a layer with another parent shows no drop line and changes nothing.

## How to get to it (user POV)

- An open deck `/deck/<id>`: the Design mode button in the toolbar, or Shift+D. Layers appears at the bottom of the left sidebar.
- `Undo layer order` and `Redo layer order` in the toolbar after a drag; `Undo rename` after a rename.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> layers-panel`. Prints `"passed":true`.
- **Shapes.** A blank deck, `Rectangle` then `Ellipse`, then a drag so they overlap. Design mode on. Evidence `NN-layers-listed`.
- **Hover and select.** Hover the rectangle's row: one `[data-chosen]` outline on the slide (`NN-layer-hovered`). Click it: the row is `aria-selected` and the slide shows its selection frame (`NN-layer-selected`).
- **Rename.** Double-click the ellipse's row, type `Badge`, Enter. The server register holds `"name":{"set":"Badge"}` (`NN-layer-renamed`).
- **Reorder.** Drag the rectangle's row onto the top edge of `Badge`. The slide and the thumbnail paint the rectangle in front, the server holds an `element-order` row, `Undo layer order` and `Redo layer order` move it back and forth, and a reload keeps it (`NN-layer-reordered`, `NN-layers-reloaded`).
- **Hide.** Hover `Badge`, click `Hide Badge`: the slide and the thumbnail stop painting it, the row reads `Badge, Hidden`, the server register holds `"hidden":{"set":true}` (`NN-layer-hidden`). Click the row, Ctrl+Shift+H: it paints again (`NN-layer-shown`).
- **Lock.** Hover the rectangle's row, click `Lock <name>`: the row reads `<name>, Locked`, a click on the rectangle on the slide selects nothing, the server register holds `"locked":{"set":true}` (`NN-layer-locked`).
- **State for look.** `layers-panel`, `layers-hidden`, `layers-locked`, `layers-rename`, `group-menu`.
- **Shortcuts journey.** `$V journey <run> layer-shortcuts`. Prints `"passed":true`.

## Gotchas

- `blank.pptx` holds a title and a subtitle placeholder, so the panel lists four layers; the journey reads the first two rows.
- The thumbnail marks its layers with `data-thumb-element`, not `data-canvas-element`.
- Reorder by drag stays among siblings. Moving a layer into or out of a group or frame is not built.
