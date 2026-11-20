# Canvas

How a layer moves and paints on the slide while a hand holds it.

## Language

**drag**:
Moving the selection with the pointer held down. It paints at most once a frame and lands as one box edit, one undo step, when the pointer comes up.
_Avoid_: move gesture, pointer move

**resting box**:
The box a layer has when no gesture holds it. During a drag the canvas shows the dragged box, while the filmstrip and the design panel keep the resting box and catch up once the drag lands. The design panel's X, Y, Width and Height follow the dragged box.
_Avoid_: settled box, committed box, saved box

**duplicate**:
A copy of a layer, directly above it in the layer order, that becomes the selection. Ctrl+D (Cmd+D on a Mac) copies the selection in place, or the same distance further on when the selection is the copies a duplicate just made. Holding Alt (Option on a Mac) while dragging leaves the layer in place and moves a copy; letting go of Alt before the pointer comes up moves the layer itself. Each copy is one `element-clone` slide edit, and one undo takes away every copy one gesture made. An agent sends the same edit as `duplicate`. In a PowerPoint file a copy is the layer's shape with a new id.
_Avoid_: clone (in product copy), copy-paste
