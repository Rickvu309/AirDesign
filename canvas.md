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
A copy of a layer, directly above it in the layer order, that becomes the selection. Ctrl+D (Cmd+D on a Mac) copies the selection in place, or the same distance further on when the selection is the copies a duplicate just made. Holding Alt (Option on a Mac) while dragging leaves the layer in place and moves a copy; letting go of Alt before the pointer comes up moves the layer itself. Each copy is one `element-clone` slide edit, and one undo takes away every copy one gesture made. An agent sends the same edit as `duplicate`. A copy of a group or frame copies every layer in it, and a copy of a layer inside a group lands in that group just above it; Ctrl+D on a layers-panel row copies the selection the same way. In a PowerPoint file a copy is the layer's shape with a new id, and a group's copy gives every shape inside it a new id too.
_Avoid_: clone (in product copy), copy-paste

**paste**:
Layers put back on a slide from the clipboard. Ctrl+C (Cmd+C on a Mac) copies the selection to the clipboard, and Ctrl+X cuts it. Ctrl+V pastes it on the slide in view, each layer at the place it had on its own slide, so on that slide it lands over its source; a place the slide cannot hold is centered on that side, and a place out of view moves to the center of the slide's part in view. Ctrl+Shift+V pastes it with its top left on the selection's top left, and Ctrl+Shift+R pastes it to replace: each selected layer gives way to a copy with its top left on that layer's, in one undo. Ctrl+Shift+C copies the selection as a PNG picture at twice its size, for other apps. The paste becomes the selection, and one undo takes it away. A paste works in another tab and in another deck. In another deck each layer is added as it looks, image and all, with template colors and fonts taken from that deck's template style; a layer that takes its look from its slide layout, or holds an image or a frame AirDesign can't move, is refused with a notice. Each pasted layer is one `element-clone` slide edit onto that slide, and an agent sends the same edit as `duplicate` with a `slide` and an `x`, `y`. Other apps get the layers' text. In a PowerPoint file a pasted layer is its source's shape with new ids, linked from its new slide to the same image.
_Avoid_: clone (in product copy)
