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

export const borderCaps = ["flat", "rnd", "sq"] as const

export const borderCompounds = ["sng", "dbl", "thickThin", "thinThick", "tri"] as const

export const borderJoins = ["round", "bevel", "miter"] as const

export const widestBorder = 20_116_800

const arrowSize = choice(arrowSizes)

const arrow = record({ type: choice(arrowheads), width: arrowSize, length: arrowSize })

const noInputs: NoInputs = {}

export const border = trait(
  "field",
  { version: 3, shape: "db2c2c2c" },
  {
    fill: union(fillCases, "solid"),
    width: sizeUpTo(widestBorder),
    dash: choice(dashPresets),
    cap: choice(borderCaps),
    compound: choice(borderCompounds),
    join: choice(borderJoins),
    head: arrow,
    tail: arrow,
    alpha: alphaOver("fill"),
  },
  noInputs,
  ["fill", "width", "dash", "cap", "compound", "join", "head", "tail"],
)
