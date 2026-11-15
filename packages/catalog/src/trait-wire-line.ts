import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const lineWire: TraitWire<"line"> = {
  description:
    "The outline of a shape or picture, or a connector's line: its width, color, dash, ends, compound strokes, corners and arrowheads. Each field stands alone.",
  fields: {
    fill: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none" for no line; or a gradient or pattern, written as for fill.`,
      example: { line: { fill: "accent2" } },
    },
    width: { description: "Width in points, from 0 to 1584.", example: { line: { width: 3 } } },
    dash: {
      description: "The dash pattern.",
      example: { line: { dash: "sysDot" } },
    },
    cap: {
      description: "How each end of the line stops: rnd is round, sq is square.",
      example: { line: { cap: "rnd" } },
    },
    compound: {
      description: "One stroke or several: sng is single, dbl double, tri three.",
      example: { line: { compound: "dbl" } },
    },
    join: {
      description: "How the line turns a corner.",
      example: { line: { join: "bevel" } },
    },
    head: {
      description: "The arrowhead at the line's start, with its type, width and length.",
      example: { line: { head: { type: "triangle", width: "med", length: "med" } } },
    },
    tail: {
      description: "The arrowhead at the line's end, with its type, width and length.",
      example: { line: { tail: { type: "stealth", width: "lg", length: "lg" } } },
    },
  },
}
