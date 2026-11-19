import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const borderWire: TraitWire<"border"> = {
  description: "Border of a shape, image or line.",
  fields: {
    fill: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none" for no border; or a gradient or pattern, written as for fills.`,
      example: { border: { fill: "accent2" } },
    },
    width: { description: "Points.", example: { border: { width: 3 } } },
    dash: {
      example: { border: { dash: "sysDot" } },
    },
    cap: {
      description: "How each end of the line stops: rnd is round, sq is square.",
      example: { border: { cap: "rnd" } },
    },
    compound: {
      description: "One stroke or several: sng is single, dbl double, tri three.",
      example: { border: { compound: "dbl" } },
    },
    join: {
      example: { border: { join: "bevel" } },
    },
    head: {
      description: "Start arrowhead.",
      example: { border: { head: { type: "triangle", width: "med", length: "med" } } },
    },
    tail: {
      description: "End arrowhead.",
      example: { border: { tail: { type: "stealth", width: "lg", length: "lg" } } },
    },
  },
}
