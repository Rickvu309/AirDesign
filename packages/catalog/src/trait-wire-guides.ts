import type { TraitWire } from "./trait-wire.js"

export const guidesWire: TraitWire<"guides"> = {
  description: "Slides only.",
  fields: {
    ruler: {
      description: "Whole list. x: vertical line, offset from the left; y: from the top.",
      example: { guides: { ruler: [{ axis: "x", offset: 36 }] } },
    },
  },
}
