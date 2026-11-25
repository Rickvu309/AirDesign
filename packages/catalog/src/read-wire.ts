import { linkedComponentsEnabled } from "@airdesign/doom"
import * as z from "zod/v4"

import { nodeIdPattern } from "./doom-wire.js"
import { type DeckId, deckInput, deckPattern, inputRefusal, readInput } from "./wire.js"

const deckCursor = z
  .string()
  .regex(deckPattern)
  .transform((value) => value as DeckId)
  .describe("Continue after this deck id.")

const deckQuery = (components: boolean) =>
  readInput(
    z.strictObject({
      deck: deckInput,
      slide: z.string().regex(nodeIdPattern).describe("Only this slide.").exactOptional(),
      cursor: z.string().regex(nodeIdPattern).describe("Continue from this slide id.").exactOptional(),
      detail: z
        .string()
        .regex(nodeIdPattern)
        .describe(
          components
            ? "Read a path's commands or a template instance's data and findings."
            : "Include SVG commands for this path id.",
        )
        .exactOptional(),
      ...(components
        ? {
            component: z
              .string()
              .regex(/^[\w-]{1,32}$/)
              .describe("Read a template's input signature and sample.")
              .exactOptional(),
          }
        : {}),
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

const ordinaryDeckQuery = deckQuery(false)
const componentDeckQuery = deckQuery(true)
export const readDeckQuery = linkedComponentsEnabled ? componentDeckQuery : ordinaryDeckQuery
export const readDeckQueryFor = (components: boolean) => (components ? componentDeckQuery : ordinaryDeckQuery)

export const readListDecks = readInput(z.strictObject({ cursor: deckCursor.exactOptional() }), inputRefusal)
