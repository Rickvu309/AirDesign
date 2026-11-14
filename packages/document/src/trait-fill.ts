import { trait, type NoInputs } from "./trait-decl.js"
import { angle, choice, color, flag, fraction, list, mark, record, union } from "./value-kind.js"

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

const gradient = record({
  stops: list(stop, 2, 10),
  shade: union({
    linear: record({ angle, scaled: flag }),
    path: record({ kind: choice(["circle", "rect", "shape"]), focus }),
  }),
  rotateWithShape: flag,
})

const pattern = record({ preset: choice(patternPresets), fg: color, bg: color })

const noInputs: NoInputs = {}

export const fill = trait(
  "whole",
  { version: 1, shape: "5b43a296" },
  { value: union({ none: mark, solid: color, gradient, pattern, group: mark }, "solid") },
  noInputs,
  ["value"],
)
