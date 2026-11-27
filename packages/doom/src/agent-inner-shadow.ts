import type { AgentColor } from "./agent-change.js"
import { field } from "./agent-fields.js"
import type { Px } from "./paint.js"
import { type Reader, finite, object } from "./read-kit.js"

export type InnerShadow = {
  readonly color: AgentColor
  readonly x: Px
  readonly y: Px
  readonly blur: Px
  readonly spread: Px
  readonly opacity?: number
}

export type InnerLook = { readonly innerShadow?: InnerShadow | "none" }

const offset = finite(-1_000, 1_000)
const radius = finite(0, 1_000)

export const innerShadowFields = (readColor: Reader<AgentColor>) => {
  const readShadow = object(
    { color: readColor, x: offset, y: offset, blur: radius, spread: offset },
    { opacity: finite(0, 1) },
  )
  return {
    innerShadow: field(
      {
        anyOf: [
          { const: "none" },
          {
            type: "object",
            additionalProperties: false,
            required: ["color", "x", "y", "blur", "spread"],
            properties: {
              color: { type: "string" },
              x: { type: "number", minimum: -1_000, maximum: 1_000 },
              y: { type: "number", minimum: -1_000, maximum: 1_000 },
              blur: { type: "number", minimum: 0, maximum: 1_000 },
              spread: { type: "number", minimum: -1_000, maximum: 1_000 },
              opacity: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        ],
      },
      (raw) => (raw === "none" ? "none" : readShadow(raw)),
    ),
  }
}
