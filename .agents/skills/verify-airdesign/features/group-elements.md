# Group and ungroup elements

On an open deck, Shift+click adds an element to the selection, and Group (in the element's menu, or Ctrl+G) makes the chosen elements one group without moving any of them. The first click on an element of a group selects the whole group; dragging it moves every element in it, and the next click selects the element itself. Ungroup (in the menu, or Ctrl+Shift+G) puts each element back on the slide where it showed. Undo and Redo take each step back and forth, and the export writes the group as PowerPoint does.

## Sub-features

- `group` Shift+click or Ctrl+click adds elements to the selection; each selected one shows a thin ring and one frame goes around them all. Group in the menu or Ctrl+G sends one `element-group` slide command whose new group's child frame equals its own box, so nothing moves. The status reads `Grouped`.
- `group-move` the group is one movable element: a drag on any of its elements or on its selection frame moves all of them while the pointer moves, and lands one box row on the group. `Undo move` takes it back.
- `ungroup` Ungroup or Ctrl+Shift+G sends `element-ungroup` and a box row for each element, mapped through the group's offset, scale, turn and flips, so nothing moves. `Undo ungroup` puts the same group back; the export then writes the file's group byte for byte.
- `agent-group` an agent sends `{op: "group", elements: [...]}` or `{op: "ungroup", elements: [...]}` in `airdesign_edit_deck`; the new group's id comes back in elements. The panel's Undo for the run turns the group back.

## How to get to it (user POV)

- An open deck `/deck/<id>`: click an element, Shift+click another, then right-click: Group and Ungroup sit under the four stacking actions, with their shortcuts.
- `Undo group`, `Undo ungroup` and `Undo move` in the toolbar.
- Ask Aira to group two shapes.

## Driving it with verify-airdesign

Preconditions:

- `$V doctor <run>` is ok.

- **Run it.** `$V journey <run> group-elements`. Prints `"passed":true`. It is in the `recorded Aira` group of `tests/journeys/journeys.spec.ts`.
- **Group.** A blank deck, `Rectangle` then `Ellipse`, the ellipse dragged apart, then the rectangle and a Shift+click on the ellipse. Evidence `NN-group-menu` and `NN-grouped`; `deckRoutes.open` ends with an `element-group` row; neither shape moved.
- **Move, ungroup, undo.** A drag on the rectangle moves both by 120 px (`NN-group-moved`); `Undo move` and `Redo move`; Ctrl+Shift+G (`NN-ungrouped`); `Undo ungroup` ends the order with `element-regroup`.
- **Reload, export, reimport.** Evidence `group-elements.pptx` and `NN-reimported`: the moved group paints where it was.
- **Agent.** After an ungroup, the replayed stream `group.sse` calls `airdesign_edit_deck` with `op: "group"` (`NN-agent-grouped`); the panel's Undo ends the order with `element-ungroup` (`NN-agent-group-undone`).
- **States for look.** `group-menu`, `grouped`.

## Gotchas

- A group from the file whose child frame differs from its box ungroups through that frame: `tests/browser/group.spec.ts` ungroups slide 8's group in `doe-heat-pumps.pptx`, and `pnpm check:pptx` judges both exports.
- A group's shadow or glow is exported but not painted on the canvas (PR 498).
- A build without grouping still reaches `group-menu` and `grouped`, so the before side of a comparison has a picture.
