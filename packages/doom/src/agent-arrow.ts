import { choice, field } from "./agent-fields.js"
import { type Arrow, lineArrowheads } from "./geometry.js"
import { boolean, literal, oneOf } from "./read-kit.js"

export const arrowField = field(
  {
    description: "End arrowhead. true is arrow, false is none.",
    anyOf: [{ type: "boolean" }, { enum: lineArrowheads }],
  },
  oneOf<boolean | Arrow>(boolean, literal(lineArrowheads)),
)

export const startArrowField = choice(lineArrowheads, "Arrowhead where a line starts.")
