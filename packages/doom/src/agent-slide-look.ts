import { choice, field, flag, number } from "./agent-fields.js"
import type { Px } from "./paint.js"
import { integer, literal, object } from "./read-kit.js"

export type SlideTransition = {
  readonly kind: "none" | "fade" | "push" | "smartMove"
  readonly ms: number
}

export type SlideLook = {
  readonly skipped?: boolean
  readonly transition?: SlideTransition
  readonly alignV?: "top" | "center" | "bottom"
  readonly spaceBefore?: Px
  readonly spaceAfter?: Px
  readonly blur?: Px
}

const kinds = ["none", "fade", "push", "smartMove"] as const

export const slideLookFields = {
  skipped: flag("Skip this slide in Present."),
  transition: field(
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "ms"],
      properties: {
        kind: { enum: [...kinds] },
        ms: { type: "number", minimum: 0, maximum: 60_000 },
      },
      description: "How this slide arrives in Present, and for how many milliseconds.",
    },
    object({ kind: literal(kinds), ms: integer(0, 60_000) }),
  ),
  alignV: choice(["top", "center", "bottom"], "Where the words sit in the box: top, center or bottom."),
  spaceBefore: number(0, 1_000, "Space before each paragraph, in pixels."),
  spaceAfter: number(0, 1_000, "Space after each paragraph, in pixels."),
  blur: number(0, 1_000, "Blur the layer, in pixels. 0 clears it."),
}
