# Image fill

How an image is covered and softened, and how heavy an icon's lines are. A shape whose fill is an image uses the same words.

## Language

**overlay**:
The paint laid over an image, a color or a gradient, and how strongly it covers it. It is the top paint above the image in the layer's fills: the slides-mode Overlay control edits it, and an agent's `fills.overlay` writes the top slot, `p3`.
_Avoid_: tint, wash, filter

**blur**:
How soft an image looks, in percent.
_Avoid_: feather, defocus, gaussian

**weight**:
How thick an icon's lines are: Lucide's stroke width on its 24 grid, from 0.5 to 3, with Lucide's 2 when nobody set one. The lines scale with the icon. A person sets it in the Fill section's Weight field and an agent with `fills.weight`. The export draws the icon's SVG and PNG at that weight. A photo has none.
_Avoid_: thickness, line width, stroke
