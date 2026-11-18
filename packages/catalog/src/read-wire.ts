import { elementPattern } from "@airdesign/document"
import * as z from "zod/v4"

import { deckInput, deckPattern, inputRefusal, readInput } from "./wire.js"

const slidePattern = /^(?:[0-9]{1,10}|n[0-9a-z]{12})$/

const slideInput = z.string().regex(slidePattern).describe("Only this slide. Includes its template text styles.")
const elementCursor = z
  .string()
  .regex(elementPattern)
  .describe("Layer id from the previous answer. The next answer starts after it.")
const deckCursor = z
  .string()
  .regex(deckPattern)
  .describe("Deck id from the previous answer. The next answer starts after it.")

export const readDeckQuery = readInput(
  z.strictObject({
    deck: deckInput,
    slide: slideInput.exactOptional(),
    cursor: elementCursor.exactOptional(),
  }),
  inputRefusal,
)

export const readListDecks = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
