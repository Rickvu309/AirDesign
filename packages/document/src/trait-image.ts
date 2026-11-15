import { trait } from "./trait-decl.js"
import { alphaOver, color, custom, mark, record, union } from "./value-kind.js"

export const asset = custom<string, string>("asset")

export const recolors = union({ none: mark, grayscale: mark, duotone: record({ dark: color, light: color }) })

export const image = trait(
  "own",
  { version: 1, shape: "ceff7e39" },
  {
    source: asset,
    alpha: alphaOver("source"),
    recolor: recolors,
  },
)
