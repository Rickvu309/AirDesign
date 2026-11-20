import type { TraitWire } from "./trait-wire.js"

export const geometryWire: TraitWire<"geometry"> = {
  description: "A PowerPoint preset; it replaces the whole shape.",
  fields: {
    shape: {
      description: "adjust maps preset names such as adj1 to whole numbers; { } keeps defaults.",
      example: { geometry: { shape: { preset: "roundRect", adjust: { adj: 30_000 } } } },
    },
    corners: {
      description: "Corner radius in pt of a rect or roundRect; 0 squares it.",
      example: { geometry: { corners: 12 } },
    },
  },
}
