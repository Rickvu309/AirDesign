import { trait } from "./trait-decl.js"
import { flag, words } from "./value-kind.js"

export const nameBytes = 200
export const altBytes = 4000

export const identity = trait(
  "own",
  { version: 1, shape: "5ca2d09f" },
  {
    name: words(nameBytes),
    alt: words(altBytes),
    hidden: flag,
  },
)
