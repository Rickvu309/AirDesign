import { trait } from "./trait-decl.js"
import { flag, words } from "./value-kind.js"

export const nameBytes = 200
export const altBytes = 4000

export const identity = trait(
  "own",
  { version: 3, shape: "07b1daf1" },
  {
    name: words(nameBytes),
    alt: words(altBytes),
    hidden: flag,
    locked: flag,
    mask: flag,
  },
)
