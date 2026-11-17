import { trait } from "./trait-decl.js"
import { alphaOver, choice, color, custom, mark, record, union } from "./value-kind.js"

export const asset = custom<string, string>("asset")

export const recolors = union({ none: mark, grayscale: mark, duotone: record({ dark: color, light: color }) })

export const image = trait(
  "own",
  { version: 2, shape: "0d6da2f2" },
  {
    source: asset,
    mode: choice(["fill", "fit", "crop", "tile", "stretch"]),
    alpha: alphaOver("source"),
    recolor: recolors,
  },
)
