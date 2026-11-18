# Image fill

How an image is covered and softened. A shape whose fill is an image uses the same words.

## Language

**overlay**:
The paint laid over an image, a color or a gradient, and how strongly it covers it. It is the top paint above the image in the layer's fills: the slides-mode Overlay control edits it, and an agent's `fills.overlay` writes the top slot, `p3`.
_Avoid_: tint, wash, filter

**blur**:
How soft an image looks, in percent.
_Avoid_: feather, defocus, gaussian
