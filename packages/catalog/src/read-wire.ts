import { elementPattern } from "@airdesign/document"
import * as z from "zod/v4"

import { deckInput, deckPattern, inputRefusal, readInput } from "./wire.js"

const slidePattern = /^(?:[0-9]{1,10}|n[0-9a-z]{12})$/

const slideInput = z.string().regex(slidePattern).describe("Only this slide. Includes its template text styles.")
const elementCursor = z.string().regex(elementPattern).describe("Continue after this layer id.")
const deckCursor = z.string().regex(deckPattern).describe("Continue after this deck id.")
const pictureInput = z
  .literal(true)
  .describe("Add a picture of slide, or of the first 10 slides, as the owner's open tab paints it.")

export const readDeckQuery = readInput(
  z.strictObject({
    deck: deckInput,
    slide: slideInput.exactOptional(),
    cursor: elementCursor.exactOptional(),
    picture: pictureInput.exactOptional(),
  }),
  inputRefusal,
)

export const readListDecks = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
