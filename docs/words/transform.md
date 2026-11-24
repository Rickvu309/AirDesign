# Transform

The words for resizing, rotating, and flipping layers on the slide canvas. Kept beside `GLOSSARY.md` because `GLOSSARY.md` is at the file-size limit.

**handle**:
One of the eight resize grips on a selection bounding box: four corners (`top-left`, `top-right`, `bottom-left`, `bottom-right`) and four edges (`top`, `right`, `bottom`, `left`). Holding Shift keeps proportions; holding Alt (Option on Mac) resizes from the center.
_Avoid_: knob, dot, resize box

**rotate handle**:
The hit zone just outside each corner of a selection bounding box, showing a curved rotation cursor. Dragging turns the selection around its center; holding Shift snaps to 15-degree steps.
_Avoid_: turn knob, spinner

**flip**:
Mirroring a layer or multi-selection horizontally (`Shift+H`, `box.flipH`) or vertically (`Shift+V`, `box.flipV`).
_Avoid_: mirror, invert

**group space**:
Where a group keeps its layers' boxes: coordinates in the group's own space, scaled and turned onto the group's box. A person and an agent see and send a grouped layer's box on the slide; it is stored in its group's space, and the group's box then fits its layers, as a Figma group fits its content.
_Avoid_: child space, child coordinates, group coordinates
