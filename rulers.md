# Rulers

The scales along the canvas and the lines a person pulls out of them to line layers up.

## Language

**ruler**:
The scale along the top and the left edge of the canvas, in points from the slide's top-left corner. Shift+R, or Rulers in the zoom menu, shows or hides both rulers and every guide. The selection's outer edges show on each ruler as a blue band with its two numbers.
_Avoid_: scale bar, measure bar

**guide**:
A line across one slide, dragged out of a ruler, that layers snap to as they snap to another layer's edge. The top ruler gives a horizontal guide and the left ruler a vertical one. A guide moves by dragging, copies with Alt (Option on a Mac) held, and goes when it is dragged back onto its ruler or off the slide, or selected and deleted. While held or selected it shows its position on its ruler. Each slide has its own guides, as each Figma Slides slide does. A PowerPoint deck opens with each slide's guides as PowerPoint shows them: the deck's own guides, then the slide's layout's and master's. A slide whose guides change keeps them in an AirDesign extension, because PowerPoint has no guide on one slide; PowerPoint keeps showing the deck's guides there. An agent sets the whole list with `guides.ruler`.
_Avoid_: ruler guide, guideline, snap guide (the red line drawn while a layer is held)

**layout guide**:
Columns, rows or a square grid painted over one slide in a colour at an opacity, as Figma Slides' layout guides (Figma called them layout grids before May 2025). Added in design mode from the Layout guide section of a slide, where each one has its settings, an eye and a remove button; a new one is a 10 pt red grid at 10 %. Columns and rows stretch between a margin with a gutter between them, or keep a fixed width or height from the left, right or centre. Shift+G, Ctrl+Shift+4 or Layout guides in the zoom menu shows or hides every one. Layers snap to their edges and lines whether they show or not. PowerPoint has no layout guide, so each slide keeps its list in an AirDesign extension, and PowerPoint shows nothing. An agent sets the whole list with `guides.layout`.
_Avoid_: layout grid, grid overlay, column guide
