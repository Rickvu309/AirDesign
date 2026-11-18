import { trait, type NoInputs } from "./trait-decl.js"
import { angle, color, mark, record, sizeUpTo, union } from "./value-kind.js"

export const widestEffect = 2_540_000

const radius = sizeUpTo(widestEffect)

const offset = record({ blur: radius, distance: radius, direction: angle, color })

const halo = record({ radius, color })

const outer = union({ none: mark, outer: offset })

const inner = union({ none: mark, inner: offset })

const noInputs: NoInputs = {}

export const dropSlots = ["drop1", "drop2", "drop3"] as const

export const innerSlots = ["inner1", "inner2", "inner3"] as const

export const effects = trait(
  "whole",
  { version: 3, shape: "820d38e6" },
  {
    shadow: outer,
    innerShadow: inner,
    glow: union({ none: mark, halo }),
    softEdge: union({ none: mark, radius }, "radius"),
    blur: union({ none: mark, radius }, "radius"),
    drop1: outer,
    drop2: outer,
    drop3: outer,
    inner1: inner,
    inner2: inner,
    inner3: inner,
  },
  noInputs,
  [],
  [...dropSlots, ...innerSlots],
)
