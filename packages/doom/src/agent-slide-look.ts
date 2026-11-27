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
  skipped: flag(),
  transition: field(
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "ms"],
      properties: {
        kind: { enum: [...kinds] },
        ms: { type: "number", minimum: 0, maximum: 60_000 },
      },
    },
    object({ kind: literal(kinds), ms: integer(0, 60_000) }),
  ),
  alignV: choice(["top", "center", "bottom"]),
  spaceBefore: number(0, 1_000),
  spaceAfter: number(0, 1_000),
  blur: number(0, 1_000),
}
