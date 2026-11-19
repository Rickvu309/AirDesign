# Layers

The Layers section of the left sidebar, as Figma Slides has it in design mode.

## Language

**layers panel**:
The Layers section under the slide list in design mode. It lists the current slide's layers front first, with each group's and frame's layers nested under it. A click selects a layer on the slide, Shift selects a run of rows, Ctrl adds or removes one. A double-click, Enter or F2 renames it, as the `identity.name` field. A drag above or below a sibling moves it in the layer order, as the `element-order` row an agent sends. Hovering a row outlines its layer on the slide.
_Avoid_: outline, tree, object list

**hidden**:
A layer that does not paint on the slide, in the filmstrip or when presenting. It stays in the layers panel, dimmed, and can still be selected there. The row's eye or Ctrl+Shift+H hides or shows the selection, as the `identity.hidden` field; in a PowerPoint file it is the shape's hidden flag, the Selection Pane's eye.
_Avoid_: invisible, skipped (a skipped slide is left out when presenting)

**locked**:
A layer a person cannot pick or move on the slide: a click passes through it, and a group's lock holds every layer in it. It can still be selected in the layers panel and changed in the design panel, and an agent can still change it. The row's padlock or Ctrl+Shift+L locks or unlocks the selection, as the `identity.locked` field; in a PowerPoint file it is the shape's locks `noMove`, `noResize` and `noRot` (`noMove` and `noResize` on a table or chart frame).
_Avoid_: frozen, pinned

**layer order**:
Which layer paints in front of which. The panel lists the front layer first; a PowerPoint file keeps the back layer first.
_Avoid_: z-index, stacking order
