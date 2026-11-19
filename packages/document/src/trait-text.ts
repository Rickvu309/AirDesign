import { textFill } from "./text-fill.js"
import { trait } from "./trait-decl.js"
import {
  alignNames,
  textCases,
  letterSpacingFloor,
  letterSpacingCeiling,
  lineHeightCeiling,
  lineHeightFloor,
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
  { version: 8, shape: "aaea7ede" },
  { value: custom<string, string>("text"), alpha: alphaOver("value") },
  {
    style: words(200),
    fill: textFill,
    color,
    size: typeSize,
    font: words(typefaceBytes),
    bold: flag,
    italic: flag,
    underline: flag,
    strike: flag,
    case: choice(textCases),
    letterSpacing: pointsWithin(letterSpacingFloor, letterSpacingCeiling),
    align: choice(alignNames),
    list: choice(["none", "bullets", "numbers"]),
    lineHeight: fractionWithin(lineHeightFloor, lineHeightCeiling),
    spaceBefore: pointsUpTo(spaceCeiling),
    spaceAfter: pointsUpTo(spaceCeiling),
  },
)
