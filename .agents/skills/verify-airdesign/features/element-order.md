# Bring an element forward or send it backward

On an open deck, a right-click on an element opens Bring to front, Bring forward, Send backward and Send to back. Each one moves that element among the shapes that share its parent. A shape already at that end has the action off. The canvas says what happened, and Undo takes the move back.

## Sub-features

- `element-order` the menu on the element, and Ctrl+Shift+], Ctrl+], Ctrl+[ and Ctrl+Shift+[ when the browser delivers them. The server's `register.order` gets a `slide: "element-order"` row. The canvas and the thumbnail paint the new order at once.
- `element-order-export` the export changes only that slide's part. The moved shape's own XML stays as it was, and a group or a table in the same tree stays whole.
- A shape inside a group moves only among that group's children. It is not pulled out of the group.

## How to get to it (user POV)

- An open deck `/deck/<id>`: right-click an element on the slide. The four actions sit in that menu, with the shortcut beside each one.
- `Undo bring to front`, `Undo bring forward`, `Undo send backward` and `Undo send to back` in the toolbar take the move back.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> element-order`. Prints `"passed":true`.
- **Overlap.** A blank deck, `Rectangle` then `Ellipse`, then a drag so the ellipse covers part of the rectangle.
- **Order.** Right-click the rectangle's uncovered part, `Bring to front`. Evidence `NN-arrange-menu` and `NN-element-ordered`. The status reads `Brought to front`. `deckRoutes.open` holds an `element-order` row.
- **Undo, redo, keys, reload, export.** `Undo bring to front`, `Redo bring to front`, Ctrl+[ (`Sent backward`), `Undo send backward`, a reload, then Export. Evidence `NN-reimported` and `element-order.pptx`.
- **State for look.** `element-ordered`.

## Gotchas

- The menu is on the element. A right-click on empty slide keeps the browser's own menu.
- A build without the menu still reaches `element-ordered` so the before side of a comparison has a picture: the ellipse still covers part of the rectangle.
- Ctrl+Shift+[ may be taken by the browser. The menu still sends the shape to the back.
