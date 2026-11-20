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

**icon color**:
The color of an icon's lines, `fills.color`: a template color or any other color, drawn into the icon's SVG and PNG. A new icon takes the template's text color, Text 1, so it reads like the text beside it and turns light on a dark template. The Fill section shows it as Color beside Weight. The export keeps a plain template color's slot in the icon's file name, so the deck reads it back as that slot.
_Avoid_: tint, ink, stroke color

**icon size**:
The side of a new icon: 1.5 times the body text size of its slide, the lower middle of the text sizes there, the way Figma's 24 px icons sit beside 16 px text. A slide with no text gives one inch. A person's Add icon and an agent's `add` with `icon` and no `box` both use it.
_Avoid_: icon scale, default box
