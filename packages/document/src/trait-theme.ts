import { trait } from "./trait-decl.js"
import { typefaceBytes } from "./text-value.js"
import { hex, words } from "./value-kind.js"

const typeface = words(typefaceBytes)

export const theme = trait(
  "own",
  { version: 1, shape: "fd31b1bd" },
  {
    dk1: hex,
    lt1: hex,
    dk2: hex,
    lt2: hex,
    accent1: hex,
    accent2: hex,
    accent3: hex,
    accent4: hex,
    accent5: hex,
    accent6: hex,
    hlink: hex,
    folHlink: hex,
    major: typeface,
    minor: typeface,
  },
)
