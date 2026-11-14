import { readSlideId, schemeNames } from "@airdesign/document"
import * as z from "zod/v4"
import { deckInput, wholeInput, readInput, inputRefusal } from "./wire.js"

const slide = z
  .string()
  .describe("Slide id from airdesign_read_deck.")
  .transform((value, ctx) => {
    const id = readSlideId(value)
    if (id !== undefined) return id
    ctx.issues.push({ code: "custom", input: value, message: "Slide id" })
    return z.NEVER
  })
const head = { deck: deckInput, base: wholeInput.describe("Revision from airdesign_read_deck.") }
const color = z
  .union([
    z.strictObject({
      scheme: z.enum(schemeNames).describe("A theme colour: dk1, lt1, dk2, lt2, or accent1 to accent6."),
    }),
    z.strictObject({
      rgb: z
        .string()
        .regex(/^[0-9A-F]{6}$/)
        .describe("Six hex digits in capitals, with no #, such as 1F4E79."),
    }),
  ])
  .describe("The colour. A theme colour follows the deck's theme; an RGB colour stays as sent.")
export const slideReaders = {
  add_slide: readInput(
    z.strictObject({
      ...head,
      after: slide.describe("Insert after this slide id."),
      layout: slide.describe("Use the layout of this slide id."),
    }),
    inputRefusal,
  ),
  duplicate_slide: readInput(z.strictObject({ ...head, slide }), inputRefusal),
  set_background: readInput(z.strictObject({ ...head, slide, color }), inputRefusal),
  delete_slide: readInput(z.strictObject({ ...head, slide }), inputRefusal),
  move_slide: readInput(
    z.strictObject({
      ...head,
      slide,
      after: slide.nullable().describe("Place after this slide id, or null for the beginning."),
    }),
    inputRefusal,
  ),
}
export type SlideOp = keyof typeof slideReaders
