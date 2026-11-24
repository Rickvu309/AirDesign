# Insert a shape

In an open deck, `Shapes` in the toolbar opens the tray the design shows (`/screens/s43-04-editor-tools-shapes`), with `More shapes` for the whole grid. A pick in the tray arms that shape's tool, as R (rectangle), O (ellipse), L (line), Shift+L (arrow) and F (frame) do, like Figma's shape tools: a drag on the slide draws it, Shift keeps it square or round, a click places its default size at the click, and the tool goes back to Move. A shape lands in the theme's light fill (`background2` with a small tint) and moves, resizes and deletes like any layer; one undo takes back each add.

## Sub-features

- `shape-draw` R and a drag draws a rectangle in the box dragged; O with Shift draws a circle; a click with R places a 100 by 100 square at the click. The server holds the node with `geometry.kind` `rect` or `ellipse`.
- `shape-preset` a tray pick such as `Star` arms its preset; a drag draws it as `geometry: { kind: "preset", name: "star5" }`. `More shapes` opens the grid of presets, `[data-shape-grid]`.
- `line-draw` L draws a line (`arrows: ["none", "none"]`) and Shift+L an arrow (`["none", "arrow"]`), from where the drag starts to where it ends.
- `frame-draw` F draws a clipping frame (`clip: true`); a shape then drawn inside it lands as the frame's child.
- `shape-undo` one Ctrl/Cmd+Z after an add takes the shape away.
- `agent-shape` an agent's `airdesign_edit_deck` change `{ op: "add", kind: "shape", slide }` or `kind: "line"` with `arrow` adds the same layers.

## How to get to it (user POV)

- An open deck `/s/<id>`: `Shapes` in the toolbar under the slide opens the tray above it; Escape closes it.
- Keyboard: R, O, L, Shift+L and F, then a drag or a click on the slide.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-tools.spec.ts`: R draws a rectangle where it is dragged and the tool goes back to Move, O with Shift keeps it round, one undo takes it away; a click places a default size, F draws a frame that holds what is drawn inside it, L and Shift+L draw a line and an arrow; the tray arms a star preset. Each reads the node from `doomRoutes.open`.
- **States for look.** `shape-tray`, `shape-grid`, `shape-tray-text-focused`, `shape-drawing`, `shape-added`, `shape-after-line`, `shape-dragged`, `shape-faces`.

## Gotchas

- A level line's box is 0 px tall, so Playwright may call it hidden; read its node from `doomRoutes.open` rather than its box.
- The tool goes back to Move after each shape, so arm it again before the next one.
