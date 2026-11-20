import type { TraitWire } from "./trait-wire.js"

export const boxWire: TraitWire<"box"> = {
  description:
    "Points from the slide's top-left (72 pt/in). Auto layout children take only w and h. Plain group children take no box edits.",
  fields: {
    x: { example: { box: { x: 72 } } },
    y: { example: { box: { y: 54 } } },
    w: { example: { box: { w: 288 } } },
    h: { example: { box: { h: 216 } } },
    rot: { description: "Degrees clockwise.", example: { box: { rot: 45 } } },
    flipH: { example: { box: { flipH: true } } },
    flipV: { example: { box: { flipV: true } } },
    align: {
      description: "Align one per slide to the slide, several to their outer edges.",
      example: { box: { align: "left" } },
    },
    distribute: {
      description: "Equal gaps per slide, outer two fixed. Centers a single layer.",
      example: { box: { distribute: "horizontal" } },
    },
  },
}
