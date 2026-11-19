import { trait, type NoInputs } from "./trait-decl.js"
import { fillCases } from "./trait-fills.js"
import { alphaOver, choice, customChoice, fractionWithin, list, record, sizeUpTo, union } from "./value-kind.js"

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

const dashLength = fractionWithin(1, 2_147_483_647)
const gapLength = fractionWithin(0, 2_147_483_647)
const dashPattern = list(record({ dash: dashLength, gap: gapLength }), 1, 32)

const noInputs: NoInputs = {}

export const border = trait(
  "field",
  { version: 4, shape: "9b980f65" },
  {
    fill: union(fillCases, "solid"),
    width: sizeUpTo(widestBorder),
    dash: customChoice(dashPresets, dashPattern),
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
