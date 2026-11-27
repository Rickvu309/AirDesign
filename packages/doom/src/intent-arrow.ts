import { choice, field } from "./intent-fields.js"
import { type Arrow, lineArrowheads } from "./geometry.js"
import { boolean, literal, union } from "./read-kit.js"

export const arrowField = field(
  {
    anyOf: [{ type: "boolean" }, { enum: lineArrowheads }],
  },
  union<boolean | Arrow>({ code: "end-arrow" }, [boolean, literal(lineArrowheads)]),
)

export const startArrowField = choice(lineArrowheads)
