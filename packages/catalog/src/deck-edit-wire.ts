import { limits, doom } from "@airdesign/document"
import * as z from "zod/v4"

import {
  baseRefusal,
  batchRefusal,
  deckInput,
  deckPattern,
  fieldRefusal,
  inputRefusal,
  readInput,
  wholeInput,
  type BaseRefusal,
  type BatchRefusal,
  type DeckRefusal,
  type FieldRefusal,
} from "./wire.js"

const { $defs, properties } = doom.agentChangesSchema

export const readDeckEdit = readInput(
  z
    .strictObject({
      deck: deckInput,
      base: wholeInput.describe("The rev airdesign_read_deck answered."),
      runId: z
        .string()
        .regex(deckPattern)
        .describe("The runId your last edit answered. Left out: this edit starts a new run.")
        .exactOptional(),
      changes: z.array(z.unknown()).min(1).max(limits.batch).meta(properties.changes),
    })
    .meta({ $defs }),
  (issues, raw): FieldRefusal | DeckRefusal | BaseRefusal | BatchRefusal => {
    if (issues.some((issue) => issue.path.length === 0 || issue.path[0] === "deck")) return inputRefusal(issues, raw)
    if (issues.some((issue) => issue.path[0] === "base")) return baseRefusal
    if (issues.some((issue) => issue.path.length === 1 && issue.path[0] === "changes")) return batchRefusal
    return fieldRefusal
  },
)
