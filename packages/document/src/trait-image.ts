import { trait } from "./trait-decl.js"
import { alphaOver, choice, color, custom, fraction, mark, record, union } from "./value-kind.js"

export const asset = custom<string, string>("asset")

export const recolors = union({ none: mark, grayscale: mark, duotone: record({ dark: color, light: color }) })

export const overlays = union({ none: mark, solid: color })

export const image = trait(
  "own",
  { version: 3, shape: "25674b97" },
  {
    source: asset,
    mode: choice(["fill", "fit", "crop", "tile", "stretch"]),
    alpha: alphaOver("source"),
    recolor: recolors,
    blur: fraction,
    overlay: overlays,
  },
)
