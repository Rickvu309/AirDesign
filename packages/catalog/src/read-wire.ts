import * as z from "zod/v4"

import { nodeIdPattern } from "./doom-wire.js"
import { type DeckId, deckInput, deckPattern, inputRefusal, readInput } from "./wire.js"

const deckCursor = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Continue after this deck id.")

export const readDeckQuery = readInput(
  z.strictObject({
    deck: deckInput,
    slide: z.string().regex(nodeIdPattern).describe("Only this slide.").exactOptional(),
    cursor: z.string().regex(nodeIdPattern).describe("Continue from this slide id.").exactOptional(),
    detail: z
      .string()
      .regex(nodeIdPattern)
      .describe("Read a path's commands or a template instance's data and findings.")
      .exactOptional(),
    component: z
      .string()
      .regex(/^[\w:-]{1,32}$/)
      .describe("A component's spec, revision and instances. column is built in.")
      .exactOptional(),
    grammar: z.literal(1).describe("The component spec syntax.").exactOptional(),
    picture: z.literal(true).describe("Add a picture of each slide read, up to 10.").exactOptional(),
    find: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Only the layers whose line holds these words, across the deck: a phrase, style=heading, fill=#, picture.",
      )
      .exactOptional(),
  }),
  inputRefusal,
)

export const readListDecks = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
