# Layers

The Layers section of the left sidebar, as Figma Slides has it in design mode.

## Language

**layers panel**:
The Layers section under the slide list in design mode. It lists the current slide's layers front first, with each group's and frame's layers nested under it. A click selects a layer on the slide, Shift selects a run of rows, Ctrl adds or removes one. A double-click, Enter or F2 renames it, as the `identity.name` field. A drag moves a layer in the layer order, as the `element-order` row an agent sends, or into a group or frame and out of one, as the agent's `join` and `leave`. A blue line between rows shows where it lands, indented to its level; an outline on a group's or frame's row shows it lands inside. Near the panel's top or bottom edge the list scrolls. Press on an eye or padlock and drag down the column to set every row you pass the same way, as one undo. Hovering a row outlines its layer on the slide.
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

**fits its layers**:
What a group does after a layer joins or leaves it: its box becomes the box around its layers and every layer stays where it shows, and so does each group above it. In a PowerPoint file the group's `a:off`, `a:ext`, `a:chOff` and `a:chExt` change and its layers' bytes do not. A group whose last layer leaves deletes itself, and Undo brings it back with the layer. A frame keeps its own size. Figma: a group "is always positioned and sized to fit its content", and "a group with no children will delete itself".
_Avoid_: hug (an auto layout frame's size setting), refit, resize to fit (a frame's button)
