import type { TraitPatch } from "./row.js"
import { trait } from "./trait-decl.js"
import { asset } from "./trait-image.js"
import {
  alphaOver,
  angle,
  choice,
  color,
  flag,
  fraction,
  list,
  mark,
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

export const paint = union({ ...fillCases, image: asset, group: mark }, "solid")

export type Paint = ValueOf<typeof paint>

export const paintSlots = ["p0", "p1", "p2", "p3"] as const

export type PaintSlot = (typeof paintSlots)[number]

export const fills = trait(
  "whole",
  { version: 4, shape: "2fde11a7" },
  { p0: paint, p1: paint, p2: paint, p3: paint, alpha: alphaOver("p0") },
  { paint },
  ["p0", "paint"],
  paintSlots,
)

export type ShownFills = { readonly [S in PaintSlot]?: Paint }

export type ResolvedFills = { readonly paints: readonly Paint[]; readonly slidesMode: Paint }

export function readFills(shown: ShownFills): ResolvedFills {
  const paints = paintSlots.flatMap((slot) => {
    const held = shown[slot]
    return held === undefined || "none" in held ? [] : [held]
  })
  return { paints, slidesMode: paints.at(-1) ?? { none: true } }
}

export type FillsEdit = { readonly paint: Paint | null }

export function changeFills(edit: FillsEdit): TraitPatch<"fills"> {
  const [bottom, ...above] = paintSlots
  const cleared = Object.fromEntries(above.map((slot) => [slot, { set: { none: true } }]))
  return { [bottom]: edit.paint === null ? "inherit" : { set: edit.paint }, ...cleared }
}
