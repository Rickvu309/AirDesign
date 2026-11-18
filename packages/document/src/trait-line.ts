import { trait, type NoInputs } from "./trait-decl.js"
import { fillCases } from "./trait-fills.js"
import { alphaOver, choice, record, sizeUpTo, union } from "./value-kind.js"

export const dashPresets = [
  "solid",
  "dot",
  "dash",
  "lgDash",
  "dashDot",
  "lgDashDot",
  "lgDashDotDot",
  "sysDash",
  "sysDot",
  "sysDashDot",
  "sysDashDotDot",
] as const

export const arrowheads = ["none", "triangle", "stealth", "diamond", "oval", "arrow"] as const

export const arrowSizes = ["sm", "med", "lg"] as const

export const lineCaps = ["flat", "rnd", "sq"] as const

export const lineCompounds = ["sng", "dbl", "thickThin", "thinThick", "tri"] as const

export const lineJoins = ["round", "bevel", "miter"] as const

export const widestLine = 20_116_800

const arrowSize = choice(arrowSizes)

const arrow = record({ type: choice(arrowheads), width: arrowSize, length: arrowSize })

const noInputs: NoInputs = {}

export const line = trait(
  "field",
  { version: 2, shape: "db2c2c2c" },
  {
    fill: union(fillCases, "solid"),
    width: sizeUpTo(widestLine),
    dash: choice(dashPresets),
    cap: choice(lineCaps),
    compound: choice(lineCompounds),
    join: choice(lineJoins),
    head: arrow,
    tail: arrow,
    alpha: alphaOver("fill"),
  },
  noInputs,
  ["fill", "width", "dash", "cap", "compound", "join", "head", "tail"],
)
