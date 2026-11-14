import { trait } from "./trait-decl.js"
import { choice, color, custom, flag, typeSize } from "./value-kind.js"

export const text = trait(
  "run",
  { version: 0, shape: "7bd8d0c1" },
  { value: custom<string, string>("text") },
  {
    color,
    size: typeSize,
    bold: flag,
    italic: flag,
    underline: flag,
    align: choice(["left", "center", "right"]),
    bullet: flag,
  },
)
