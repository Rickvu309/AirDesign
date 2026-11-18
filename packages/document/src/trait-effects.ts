import { trait, type NoInputs } from "./trait-decl.js"
import { angle, color, mark, record, sizeUpTo, union } from "./value-kind.js"

export const widestEffect = 2_540_000

const radius = sizeUpTo(widestEffect)

const offset = record({ blur: radius, distance: radius, direction: angle, color })

const halo = record({ radius, color })

const noInputs: NoInputs = {}

export const effects = trait(
  "whole",
  { version: 2, shape: "8899ef6e" },
  {
    shadow: union({ none: mark, outer: offset }),
    innerShadow: union({ none: mark, inner: offset }),
    glow: union({ none: mark, halo }),
    softEdge: union({ none: mark, radius }, "radius"),
    blur: union({ none: mark, radius }, "radius"),
  },
  noInputs,
)
