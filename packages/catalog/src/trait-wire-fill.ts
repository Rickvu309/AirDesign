import type { TraitWire } from "./trait-wire.js"

const navy = "1F4E79"

export const fillWire: TraitWire<"fill"> = {
  description:
    "What fills a shape: one color, a gradient, a pattern, no fill, or its group's fill. Send null to go back to the fill the shape's layout, master or theme style gives it.",
  fields: {
    value: {
      description: `A color such as "accent1", "#${navy}" or "accent1 lumMod 75" for one color; "none" for no fill; "group" for the fill of the group the shape is in; { gradient: { stops, shade, rotateWithShape } } with 2 to 10 stops [{ pos, color }], pos in percent along the gradient, and shade { linear: { angle, scaled } } with the angle in degrees or { path: { kind, focus: { l, t, r, b } } } with kind circle, rect or shape and focus in percent; or { pattern: { preset, fg, bg } } with a PowerPoint pattern preset such as "dkDnDiag" and its two colors.`,
      example: { fill: { value: "accent2" } },
    },
  },
}
