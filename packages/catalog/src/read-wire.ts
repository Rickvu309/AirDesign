import { scene } from "@airdesign/document"
import * as z from "zod/v4"

import { type DeckId, deckInput, deckPattern, inputRefusal, readInput } from "./wire.js"

const nodePattern = new RegExp(scene.agentChangesSchema.$defs.id.pattern)
const deckCursor = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Continue after this deck id.")

export const readDeckQuery = readInput(
  z.strictObject({
    deck: deckInput,
    slide: z.string().regex(nodePattern).describe("Only this slide.").exactOptional(),
    cursor: z.string().regex(nodePattern).describe("Continue from this slide id.").exactOptional(),
  }),
  inputRefusal,
)

export const readListDecks = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
