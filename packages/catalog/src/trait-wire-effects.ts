import type { TraitWire } from "./trait-wire.js"

const black = "000000"

export const effectsWire: TraitWire<"effects"> = {
  description: "Shadow, glow and soft edge, sizes in points. Setting one keeps the others.",
  fields: {
    shadow: {
      description: "Outer shadow; direction in degrees.",
      example: { effects: { shadow: { outer: { blur: 4, distance: 3, direction: 45, color: `#${black} alpha 35` } } } },
    },
    glow: {
      description: "Glow around the edge.",
      example: { effects: { glow: { halo: { radius: 8, color: "accent1 alpha 60" } } } },
    },
    softEdge: {
      description: "Fades the edge inward by a radius.",
      example: { effects: { softEdge: 5 } },
    },
  },
}
