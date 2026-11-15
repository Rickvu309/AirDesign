import type { TraitWire } from "./trait-wire.js"

export const cropWire: TraitWire<"crop"> = {
  description: "A picture's crop.",
  fields: {
    rect: {
      description: "Percent of the picture cut from its left, top, right and bottom; the frame keeps its size.",
      example: { crop: { rect: { l: 10, t: 0, r: 10, b: 0 } } },
    },
  },
}
