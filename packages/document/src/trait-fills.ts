import type { TraitPatch } from "./row.js"
import { trait } from "./trait-decl.js"
import {
  alphaOver,
  angle,
  choice,
  color,
  flag,
  fraction,
  list,
  mark,
  pictureSource,
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

export const overlays = union({ none: mark, solid: color })

export const fillModes = ["fill", "fit", "crop", "tile", "stretch"] as const

const slotPaint = union({ ...fillCases, image: mark, group: mark }, "solid")

export const paint = union({ ...fillCases, image: pictureSource, group: mark }, "solid")

export type Paint = ValueOf<typeof paint>

export type SlotPaint = ValueOf<typeof slotPaint>

export type ShownPaint = Exclude<Paint, { readonly image: string }> | { readonly image: string | null }

export const paintSlots = ["p0", "p1", "p2", "p3"] as const

export type PaintSlot = (typeof paintSlots)[number]

export const fills = trait(
  "whole",
  { version: 12, shape: "8542c018" },
  {
    p0: slotPaint,
    p1: slotPaint,
    p2: slotPaint,
    p3: slotPaint,
    source: pictureSource,
    mode: choice(fillModes),
    crop: record({ l: fraction, t: fraction, r: fraction, b: fraction }),
    recolor: recolors,
    blur: fraction,
    overlay: overlays,
    alpha: alphaOver("p0"),
  },
  { paint },
  ["p0", "paint"],
  paintSlots,
)

export type ShownFills = { readonly [S in PaintSlot]?: SlotPaint } & { readonly source?: string | null }

export type ResolvedFills = { readonly paints: readonly ShownPaint[]; readonly slidesMode: ShownPaint }

export function readFills(shown: ShownFills): ResolvedFills {
  const paints = paintSlots.flatMap((slot): ShownPaint[] => {
    const held = shown[slot]
    if (held === undefined || "none" in held) return []
    return "image" in held ? [{ image: shown.source ?? null }] : [held]
  })
  return { paints, slidesMode: paints.at(-1) ?? { none: true } }
}

export type FillsEdit = { readonly paint: Paint | null }

export function changeFills(edit: FillsEdit): TraitPatch<"fills"> {
  const [bottom, ...above] = paintSlots
  const cleared = Object.fromEntries(above.map((slot) => [slot, { set: { none: true } }]))
  const { paint: chosen } = edit
  if (chosen === null) return { [bottom]: "inherit", ...cleared }
  if (!("image" in chosen)) return { [bottom]: { set: chosen }, ...cleared }
  return { [bottom]: { set: { image: true } }, ...cleared, source: { set: chosen.image } }
}
