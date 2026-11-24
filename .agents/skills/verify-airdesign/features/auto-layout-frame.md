# Auto layout frames

An auto layout frame is a frame node whose `layout` lays its children out in a row or a column, a `gap` apart, inside its `padding`, placed by its `align`, as in Figma. Its `sizing` makes each side hug the children or stay fixed, and a child's own `sizing` can fill the frame's free length. Agents make them (`op: "wrap"` with a `layout`, or `op: "add"` with `kind: "frame"` and `layout`, `gap` and `padding`), and the agent patterns lay their cards out with them. A person sees the frame laid out, picks a child by double-click, resizes the frame, and takes auto layout off in the Design panel.

## Sub-features

- `layout` a frame with `layout: { mode: "row" | "column", gap, padding, align }` paints each child at its place in the flow; the children's own `x` and `y` are not used. A child with `absolute: true` keeps its own place (`packages/doom/src/solve-layout.ts`).
- `frame-paint` the frame's own `fills`, `radius`, `strokes` and shadow paint behind its children, set from the Design panel's Fill, Corners, Border and Shadow as for a shape (`panel-frame`).
- `pick-child` a click on a child selects the frame; a double-click selects the child. A child laid out by the frame does not move by a drag (`flows` in `packages/doom/src/doom-walk.ts`).
- `sizing` a side that hugs (`sizing.w` or `sizing.h` is `hug`) follows the children. Dragging that side's grip resizes the frame and makes the side `fixed` in the same undo step (`apps/web/src/editor/transform-drag.ts`). A child whose side is `fill` takes an equal share of the frame's free length along the flow.
- `growing-text` a text child that grows with its words pushes the next children along as it is typed, and undo takes the words back.
- `remove` `Remove auto layout` in the Design panel, shown for a frame with auto layout, writes `layout: { mode: "none" }`; the frame keeps its children. While a required font loads, the button stays focusable while disabled and a line below it explains why. An agent's `{ op: "set", target, layout: "none" }` bakes the same boxes with the server's measure, which falls back like the canvas (`fallback font` in `docs/words/text.md`), and refuses with `fonts` for the measured text in the frame if its font is pending, a letter needs a system font, or the text needs contextual shaping (including Hangul and emoji sequences), or it has a U+FE0E text-presentation selector; `tests/browser/editor-remove-auto-layout.spec.ts` holds the two within 0.5 px.
- `nested` a frame with auto layout can sit inside another; a click picks the outer frame and each double-click steps one level in.
- `agent-layout` an agent's `airdesign_edit_deck` change `{ op: "wrap", nodes, layout: "row" | "column" }` wraps layers in a new auto layout frame, `{ op: "add", kind: "frame", layout, gap, padding }` adds one, and `{ op: "set", target, layout, gap, padding }` changes one (`AgentLook` in `packages/doom/src/agent-change.ts`; cases in `packages/doom/src/agent-layout.test.ts`).

## How to get to it (user POV)

- An open deck `/s/<id>` holding an auto layout frame, such as a slide an agent laid out with a pattern: click the frame, double-click a child.
- The Design panel with the frame selected: `Remove auto layout` under its title.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Browser tests.** `pnpm test:browser tests/browser/editor-design.spec.ts`: selecting an auto layout frame and pressing `Remove auto layout` in `[data-auto-layout]` saves `layout.mode` `none`.
- **States for look.** `panel-frame`, `frame-auto-child` (a child picked by double-click), `frame-child` (a child picked after Remove auto layout), `frame-fixed` (a hugging frame's side dragged, saved as `fixed`), `frame-fill-resizing` (the side held with a child set to `fill`), `frame-text-undone` (three typed lines push the next card down, then undo), `frame-nested`. Most open `autoRow` or `nestedFrames` from `../look/doom-canvas.mjs`.

## Gotchas

- A frame's `box` is its own place in its parent; with auto layout its children's places come from the solve, so read them from the canvas, not from their stored `box`.
- A person makes a plain frame with F or Ctrl/Cmd+Alt+G (see `shape-insert.md` and `group-elements.md`); auto layout comes from an agent or a pattern.
