import { trait, type NoInputs } from "./trait-decl.js"
import { choice, count, flag, record, size } from "./value-kind.js"

export const anchors = ["t", "ctr", "b"] as const

export const autofits = ["none", "shrink", "grow"] as const

export const verticals = ["horz", "vert", "vert270"] as const

export const mostColumns = 16

const noInputs: NoInputs = {}

export const body = trait(
  "field",
  { version: 1, shape: "fbdbb36e" },
  {
    insets: record({ left: size, top: size, right: size, bottom: size }),
    anchor: choice(anchors),
    wrap: flag,
    autofit: choice(autofits),
    vertical: choice(verticals),
    columns: count(1, mostColumns),
  },
  noInputs,
  ["insets", "anchor", "wrap", "autofit", "vertical", "columns"],
)
