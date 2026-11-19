import type { TraitWire } from "./trait-wire.js"

export const boxWire: TraitWire<"box"> = {
  description:
    "Where the layer sits and its size, in points from the slide's top-left (72 points an inch). Inside auto layout only w and h; inside a group none.",
  fields: {
    x: { description: "Left edge.", example: { box: { x: 72 } } },
    y: { description: "Top edge.", example: { box: { y: 54 } } },
    w: { description: "Width in points.", example: { box: { w: 288 } } },
    h: { description: "Height in points.", example: { box: { h: 216 } } },
    rot: { description: "Degrees clockwise.", example: { box: { rot: 45 } } },
    flipH: { description: "true mirrors left to right.", example: { box: { flipH: true } } },
    flipV: { description: "true mirrors top to bottom.", example: { box: { flipV: true } } },
    align: {
      description: "One per slide lines up with the slide, several with their outer edges.",
      example: { box: { align: "left" } },
    },
    distribute: {
      description: "Equal gaps on each slide, outer two kept; one alone is centred.",
      example: { box: { distribute: "horizontal" } },
    },
  },
}
