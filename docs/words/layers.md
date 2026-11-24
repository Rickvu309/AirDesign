# Layers

The layers on a slide and how they stack, show and hold still.

## Language

**hidden**:
A layer that does not paint on the slide, in the filmstrip or when presenting. Ctrl+Shift+H hides or shows the selection, as the layer's `hidden` prop.
_Avoid_: invisible, skipped (a skipped slide is left out when presenting)

**locked**:
A layer a person cannot pick or move on the slide: a click passes through it, and a group's lock holds every layer in it. An agent can still change it. Ctrl+Shift+L locks or unlocks the selection, as the layer's `locked` prop.
_Avoid_: frozen, pinned

**layer order**:
Which layer paints in front of which.
_Avoid_: z-index, stacking order

**fits its layers**:
What a group does after a layer joins or leaves it: its box becomes the box around its layers and every layer stays where it shows, and so does each group above it. A group whose last layer leaves deletes itself, and Undo brings it back with the layer. A frame keeps its own size. Figma: a group "is always positioned and sized to fit its content", and "a group with no children will delete itself".
_Avoid_: hug (an auto layout frame's size setting), refit, resize to fit (a frame's button)
