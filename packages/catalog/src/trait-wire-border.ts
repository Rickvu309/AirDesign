import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const borderWire: TraitWire<"border"> = {
  description:
    "A shape, image or line's border: width, color, dash, ends, compound strokes, corners and arrowheads, each alone.",
  fields: {
    fill: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none" for no border; or a gradient or pattern, written as for fills.`,
      example: { border: { fill: "accent2" } },
    },
    width: { description: "Width in points, from 0 to 1584.", example: { border: { width: 3 } } },
    dash: {
      description: "The dash pattern.",
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
      description: "How the border turns a corner.",
      example: { border: { join: "bevel" } },
    },
    head: {
      description: "The arrowhead at the line's start, with its type, width and length.",
      example: { border: { head: { type: "triangle", width: "med", length: "med" } } },
    },
    tail: {
      description: "The arrowhead at the line's end, with its type, width and length.",
      example: { border: { tail: { type: "stealth", width: "lg", length: "lg" } } },
    },
  },
}
