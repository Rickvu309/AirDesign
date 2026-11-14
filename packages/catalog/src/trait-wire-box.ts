import type { TraitWire } from "./trait-wire.js"

export const boxWire: TraitWire<"box"> = {
  description:
    "Where the element sits on the slide and how big it is, in points from the slide's top-left corner. 72 points is one inch. A table takes x and y only, since its rows and columns set its size. An element inside a group has no box of its own.",
  fields: {
    x: { description: "Left edge, in points from the slide's left edge.", example: { box: { x: 72 } } },
    y: { description: "Top edge, in points from the slide's top edge.", example: { box: { y: 54 } } },
    w: { description: "Width in points.", example: { box: { w: 288 } } },
    h: { description: "Height in points.", example: { box: { h: 216 } } },
  },
}
