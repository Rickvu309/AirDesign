# Canvas

How a layer moves and paints on the slide while a hand holds it.

## Language

**drag**:
Moving the selection with the pointer held down. It paints at most once a frame and lands as one box edit, one undo step, when the pointer comes up.
_Avoid_: move gesture, pointer move

**resting box**:
The box a layer has when no gesture holds it. During a drag the canvas shows the dragged box, while the filmstrip and the design panel keep the resting box and catch up once the drag lands. The design panel's X, Y, Width and Height follow the dragged box.
_Avoid_: settled box, committed box, saved box

**shape tool**:
The tool R (Rectangle), O (Ellipse), L (Line), Shift+L (Arrow) or a pick in the Shapes menu arms, as Figma's shape tools. A drag on the slide draws the shape at the size dragged, its dragged corner snapping as a resize does and Control turning that off; Shift keeps it square or round, or a line to 45° steps, and Alt draws from the press as the centre. A click places the shape's default size with its top left at the click, and Enter places it where an added shape used to land, with no pointer. Either goes back to Move; Esc or V puts the tool down. In grid view a pick in the Shapes menu still adds the shape to the chosen slide at once, as Add text does there. The add is the same `element-add` an agent sends; a line drawn up or to the left keeps its start where the drag began through the box's flips.
_Avoid_: shape insert, drop a shape

**line end drag**:
Dragging one end of a line or connector. The line itself moves with the end, painted in its own stroke, while the resting line and its selection ring are hidden; it lands as one connection or box edit when the pointer comes up.
_Avoid_: aim preview, dashed preview

**duplicate**:
A copy of a layer, directly above it in the layer order, that becomes the selection. Ctrl+D (Cmd+D on a Mac) copies the selection in place, or the same distance further on when the selection is the copies a duplicate just made. Holding Alt (Option on a Mac) while dragging leaves the layer in place and moves a copy; letting go of Alt before the pointer comes up moves the layer itself. Each copy is one `element-clone` slide edit, and one undo takes away every copy one gesture made. An agent sends the same edit as `duplicate`. A copy of a group or frame copies every layer in it, and a copy of a layer inside a group lands in that group just above it; Ctrl+D on a layers-panel row copies the selection the same way. In a PowerPoint file a copy is the layer's shape with a new id, and a group's copy gives every shape inside it a new id too.
_Avoid_: clone (in product copy), copy-paste

**paste**:
Layers put back on a slide from the clipboard. Ctrl+C (Cmd+C on a Mac) copies the selection to the clipboard, and Ctrl+X cuts it. Ctrl+V pastes it on the slide in view, each layer at the place it had on its own slide, so on that slide it lands over its source; a place the slide cannot hold is centered on that side, and a place out of view moves to the center of the slide's part in view. Ctrl+Shift+V pastes it with its top left on the selection's top left, and Ctrl+Shift+R pastes it to replace: each selected layer gives way to a copy with its top left on that layer's, in one undo. Ctrl+Shift+C copies the selection as a PNG picture at twice its size, for other apps. The paste becomes the selection, and one undo takes it away. A paste works in another tab and in another deck. In another deck each layer is added as it looks, image and all, with template colors and fonts taken from that deck's template style; a layer that takes its look from its slide layout, or holds an image or a frame AirDesign can't move, is refused with a notice. Each pasted layer is one `element-clone` slide edit onto that slide, and an agent sends the same edit as `duplicate` with a `slide` and an `x`, `y`. Other apps get the layers' text. In a PowerPoint file a pasted layer is its source's shape with new ids, linked from its new slide to the same image.
_Avoid_: clone (in product copy)

**left-out edit**:
An edit the deck holds that this device cannot write into its PowerPoint file. The slides and an export leave it out, with the layers it made and their rows, so every edit before and after it still paints and saves, and the deck still opens after a reload. The editor says "Unable to show some edits" once for it. `writtenDeck` in `packages/pptx` finds it when the deck's edits do not write together.
_Avoid_: dropped edit, broken edit, failed edit

**painted row height**:
The height a table row shows on the canvas: its own height, or more while its text needs more. The table's frame follows it while a person types, a row border drag stops at the row's text, and the export writes it as the row's height in the file. Figma's plugin API calls the least height a row's "minimum size".
_Avoid_: auto row height, row fit

**painted ahead**:
An edit the canvas shows before the device stored it. The editor keeps these edits in the order the person made them and lays them over every deck it paints from the device, and drops each one once the device wrote its rows. Typing, every Design panel change, a drag's boxes, text the Text tool places, and every inserted, removed, grouped or duplicated layer paint ahead, so an edit never waits for an earlier save to paint; the save order stays the order of the edits. While any edit is painted ahead or still waits to reach AirDesign, the editor says Saving… and the browser asks before the tab reloads or closes, as Figma does with changes it has not synced. An export waits until every edit painted ahead is written, so the file holds what the canvas shows.
_Avoid_: optimistic update, preview, pending paint
