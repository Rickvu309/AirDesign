import type { TraitWire } from "./trait-wire.js"

export const bodyWire: TraitWire<"body"> = {
  description: "How a layer lays out its text. Fields stand alone.",
  fields: {
    insets: {
      description: "Space between each edge and the text, in points.",
      example: { body: { insets: { left: 9, top: 9, right: 9, bottom: 9 } } },
    },
    anchor: { description: "Where the text sits: t top, ctr middle, b bottom.", example: { body: { anchor: "b" } } },
    wrap: { description: "false keeps each line on one line.", example: { body: { wrap: false } } },
    autofit: {
      description: "shrink shrinks overflowing text; grow makes the box taller.",
      example: { body: { autofit: "grow" } },
    },
    vertical: {
      description: "vert turns the text a quarter clockwise, vert270 anticlockwise.",
      example: { body: { vertical: "vert" } },
    },
    columns: { description: "How many columns the text flows through.", example: { body: { columns: 2 } } },
  },
}
