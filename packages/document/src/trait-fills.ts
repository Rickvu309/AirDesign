import { trait } from "./trait-decl.js"
import {
  alphaOver,
  angle,
  choice,
  color,
  flag,
  fraction,
  fractionWithin,
  list,
  mark,
  pictureSource,
  pointsWithin,
  record,
  union,
  type ValueOf,
} from "./value-kind.js"

export const patternPresets = [
  "pct5",
  "pct10",
  "pct20",
  "pct25",
  "pct30",
  "pct40",
  "pct50",
  "pct60",
  "pct70",
  "pct75",
  "pct80",
  "pct90",
  "horz",
  "vert",
  "ltHorz",
  "ltVert",
  "dkHorz",
  "dkVert",
  "narHorz",
  "narVert",
  "dashHorz",
  "dashVert",
  "cross",
  "dnDiag",
  "upDiag",
  "ltDnDiag",
  "ltUpDiag",
  "dkDnDiag",
  "dkUpDiag",
  "wdDnDiag",
  "wdUpDiag",
  "dashDnDiag",
  "dashUpDiag",
  "diagCross",
  "smCheck",
  "lgCheck",
  "smGrid",
  "lgGrid",
  "dotGrid",
  "smConfetti",
  "lgConfetti",
  "horzBrick",
  "diagBrick",
  "solidDmnd",
  "openDmnd",
  "dotDmnd",
  "plaid",
  "sphere",
  "weave",
  "divot",
  "shingle",
  "wave",
  "trellis",
  "zigZag",
] as const

const focus = record({ l: fraction, t: fraction, r: fraction, b: fraction })

const stop = record({ pos: fraction, color })

export const gradient = record({
  stops: list(stop, 2, 10),
  shade: union({
    linear: record({ angle, scaled: flag }),
    path: record({ kind: choice(["circle", "rect", "shape"]), focus }),
  }),
  rotateWithShape: flag,
})

const pattern = record({ preset: choice(patternPresets), fg: color, bg: color })

export const fillCases = { none: mark, solid: color, gradient, pattern } as const

export const recolors = union({ none: mark, grayscale: mark, duotone: record({ dark: color, light: color }) })

export const fillModes = ["fill", "fit", "crop", "tile", "stretch"] as const

export const iconWeights = { lightest: 50, lucide: 200, heaviest: 300 } as const

const iconWeight = pointsWithin(iconWeights.lightest, iconWeights.heaviest)

const shownPaint = union({ ...fillCases, image: mark, group: mark }, "solid")

const slotPaint = union({ ...fillCases, image: mark, group: mark, hidden: shownPaint }, "solid")

export const overlay = union({ none: mark, solid: color, gradient }, "solid")

export type Overlay = ValueOf<typeof overlay>

export const paint = union({ ...fillCases, image: pictureSource, group: mark }, "solid")

export type Paint = ValueOf<typeof paint>

export const paintSlots = ["p0", "p1", "p2", "p3"] as const

export const fills = trait(
  "whole",
  { version: 16, shape: "1b9de803" },
  {
    p0: slotPaint,
    p1: slotPaint,
    p2: slotPaint,
    p3: slotPaint,
    source: pictureSource,
    weight: iconWeight,
    color,
    mode: choice(fillModes),
    tileScale: fractionWithin(1000, 1_000_000),
    crop: record({ l: fraction, t: fraction, r: fraction, b: fraction }),
    recolor: recolors,
    blur: fraction,
    alpha: alphaOver("p0"),
  },
  { paint, overlay },
  ["p0", "paint"],
  paintSlots,
)
