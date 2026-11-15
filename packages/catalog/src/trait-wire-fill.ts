import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const fillWire: TraitWire<"fill"> = {
  description:
    "What fills a shape, or with a slide target the slide's background: one color, a gradient, a pattern, no fill, or a shape's group's fill.",
  fields: {
    value: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75"; "none"; "group" for the fill of the shape's group; a gradient, with pos and focus in percent and the angle in degrees; or a PowerPoint pattern preset such as "dkDnDiag" with its two colors.`,
      example: { fill: { value: "accent2" } },
    },
  },
}
