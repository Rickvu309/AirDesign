import { trait } from "./trait-decl.js"
import { fraction, record } from "./value-kind.js"

export const crop = trait(
  "own",
  { version: 1, shape: "3c06b041" },
  {
    rect: record({ l: fraction, t: fraction, r: fraction, b: fraction }),
  },
)
