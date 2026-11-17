import { textFill } from "./text-fill.js"
import { trait } from "./trait-decl.js"
import {
  letterSpacingFloor,
  letterSpacingCeiling,
  lineSpacingCeiling,
  lineSpacingFloor,
  spaceCeiling,
  typefaceBytes,
} from "./text-value.js"
import {
  alphaOver,
  choice,
  color,
  custom,
  flag,
  fractionWithin,
  pointsUpTo,
  pointsWithin,
  typeSize,
  words,
} from "./value-kind.js"

export const text = trait(
  "run",
  { version: 4, shape: "aaea7ede" },
  { value: custom<string, string>("text"), alpha: alphaOver("value") },
  {
    fill: textFill,
    color,
    size: typeSize,
    font: words(typefaceBytes),
    bold: flag,
    italic: flag,
    underline: flag,
    strike: flag,
    letterSpacing: pointsWithin(letterSpacingFloor, letterSpacingCeiling),
    align: choice(["left", "center", "right"]),
    list: choice(["none", "bullets", "numbers"]),
    lineSpacing: fractionWithin(lineSpacingFloor, lineSpacingCeiling),
    spaceBefore: pointsUpTo(spaceCeiling),
    spaceAfter: pointsUpTo(spaceCeiling),
  },
)
