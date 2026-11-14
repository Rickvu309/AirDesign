import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

const arrow =
  'Send all three: type "none", "triangle", "stealth", "diamond", "oval" or "arrow"; width and length "sm", "med" or "lg".'

export const lineWire: TraitWire<"line"> = {
  description:
    "The outline of a shape or picture, or a connector's line: its width, color, dash, ends, compound strokes, corners and arrowheads. Each field stands alone. Send null for a field to go back to what the layout, master or theme style gives it.",
  fields: {
    fill: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none" for no line; or a gradient or pattern, written as for fill.`,
      example: { line: { fill: "accent2" } },
    },
    width: { description: "Width in points, from 0 to 1584.", example: { line: { width: 3 } } },
    dash: {
      description:
        'One of "solid", "dot", "dash", "lgDash", "dashDot", "lgDashDot", "lgDashDotDot", "sysDash", "sysDot", "sysDashDot" or "sysDashDotDot".',
      example: { line: { dash: "sysDot" } },
    },
    cap: {
      description: 'How each end of the line stops: "flat", "rnd" for round or "sq" for square.',
      example: { line: { cap: "rnd" } },
    },
    compound: {
      description:
        'One stroke or several: "sng" single, "dbl" double, "thickThin", "thinThick" or "tri" for three strokes.',
      example: { line: { compound: "dbl" } },
    },
    join: {
      description: 'How the line turns a corner: "round", "bevel" or "miter".',
      example: { line: { join: "bevel" } },
    },
    head: {
      description: `The arrowhead at the line's start. ${arrow}`,
      example: { line: { head: { type: "triangle", width: "med", length: "med" } } },
    },
    tail: {
      description: `The arrowhead at the line's end. ${arrow}`,
      example: { line: { tail: { type: "stealth", width: "lg", length: "lg" } } },
    },
  },
}
