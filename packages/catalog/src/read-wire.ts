import * as z from "zod/v4"

import { type DeckId, deckPattern, inputRefusal, readInput } from "./wire.js"

const deckCursor = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Continue after this deck id.")

export const readAppState = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
