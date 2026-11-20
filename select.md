# Select

How a person picks layers on a slide, following Figma Slides.

## Language

**marquee**:
The translucent blue selection rectangle dragged from empty slide space or the canvas around the slide. It selects every top-level layer or group it touches; Shift+marquee adds to the selection, and Cmd/Ctrl+marquee deep-selects inside groups and frames.
_Avoid_: lasso, rubber-band, drag box

**deep select**:
Bypassing enclosing groups and frames with Cmd/Ctrl+click or Cmd/Ctrl+marquee to pick nested leaf layers directly. Shift+Cmd/Ctrl+click adds or removes a deep-selected layer.
_Avoid_: direct select, pierce

**hover outline**:
The 1 px blue outline drawn around the layer a click would select while a pointer rests over it (or the nested leaf while Cmd/Ctrl is held).
_Avoid_: hover ring, highlight border

**picked cells**:
The cells of a selected table that the Cells section styles. Click a cell once the table is selected to pick it, Shift-click another cell for the range between, click a row or column handle for its row or column, and Shift-click a second handle for the run between. The cell being typed in stays picked while the Design panel is used. With none picked, the Cells section styles the whole table. Escape lets them go, and Delete clears their text.
_Avoid_: cell selection, highlighted cells
