import type { TraitWire } from "./trait-wire.js"

export const borderWire: TraitWire<"border"> = {
  description: "Border.",
  fields: {
    fill: {
      description: "Color, gradient, pattern, or none.",
      example: { border: { fill: "accent2" } },
    },
    width: { description: "Points.", example: { border: { width: 3 } } },
    dash: {
      description: "Custom lengths in % of border width.",
      example: { border: { dash: "sysDot" } },
    },
    cap: {
      example: { border: { cap: "rnd" } },
    },
    compound: {
      example: { border: { compound: "dbl" } },
    },
    join: {
      example: { border: { join: "bevel" } },
    },
    head: {
      example: { border: { head: { type: "triangle", width: "med", length: "med" } } },
    },
    tail: {
      example: { border: { tail: { type: "stealth", width: "lg", length: "lg" } } },
    },
  },
}
