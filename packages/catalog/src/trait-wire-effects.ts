import type { TraitWire } from "./trait-wire.js"

const black = "000000"
const offset = { blur: 4, distance: 3, direction: 45, color: `#${black} alpha 35` } as const
const drop = { outer: offset }
const inner = { inner: offset }

export const effectsWire: TraitWire<"effects"> = {
  description:
    "Points and degrees. Drop shadows: shadow, drop1–3. Inner shadows: innerShadow, inner1–3. Titles and bodies take shadow only. none clears a slot.",
  fields: {
    shadow: {
      example: { effects: { shadow: drop } },
    },
    innerShadow: {
      example: { effects: { innerShadow: inner } },
    },
    drop1: { example: { effects: { drop1: drop } } },
    drop2: { example: { effects: { drop2: drop } } },
    drop3: { example: { effects: { drop3: drop } } },
    inner1: { example: { effects: { inner1: inner } } },
    inner2: { example: { effects: { inner2: inner } } },
    inner3: { example: { effects: { inner3: inner } } },
    glow: {
      example: { effects: { glow: { halo: { radius: 8, color: "accent1 alpha 60" } } } },
    },
    softEdge: {
      description: "Fades the edge inward by a radius.",
      example: { effects: { softEdge: 5 } },
    },
    blur: {
      example: { effects: { blur: 4 } },
    },
  },
}
