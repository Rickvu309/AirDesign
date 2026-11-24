import { choice, field } from "./agent-fields.js"
import { type Arrow, lineArrowheads } from "./geometry.js"
import { boolean, literal, union } from "./read-kit.js"

export const arrowField = field(
  {
    description: "End arrowhead. true is arrow, false is none.",
    anyOf: [{ type: "boolean" }, { enum: lineArrowheads }],
  },
  union<boolean | Arrow>("true, false, or one of none, arrow, triangle, circle.", [boolean, literal(lineArrowheads)]),
)

export const startArrowField = choice(lineArrowheads, "Arrowhead where a line starts.")
