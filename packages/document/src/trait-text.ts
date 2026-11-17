import { trait } from "./trait-decl.js"
import { lineSpacingCeiling, lineSpacingFloor, spaceCeiling, typefaceBytes } from "./text-value.js"
import { alphaOver, choice, color, custom, flag, fractionWithin, pointsUpTo, typeSize, words } from "./value-kind.js"

export const text = trait(
  "run",
  { version: 3, shape: "aaea7ede" },
  { value: custom<string, string>("text"), alpha: alphaOver("value") },
  {
    color,
    size: typeSize,
    font: words(typefaceBytes),
    bold: flag,
    italic: flag,
    underline: flag,
    align: choice(["left", "center", "right"]),
    bullet: flag,
    lineSpacing: fractionWithin(lineSpacingFloor, lineSpacingCeiling),
    spaceBefore: pointsUpTo(spaceCeiling),
    spaceAfter: pointsUpTo(spaceCeiling),
  },
)
