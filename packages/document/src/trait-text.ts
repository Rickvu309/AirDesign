import { trait } from "./trait-decl.js"
import { alphaOver, choice, color, custom, flag, typeSize } from "./value-kind.js"

export const text = trait(
  "run",
  { version: 1, shape: "aaea7ede" },
  { value: custom<string, string>("text"), alpha: alphaOver("value") },
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
