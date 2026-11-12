import { coordinates, elementId, elementPattern, readSlideId } from "@airdesign/document"
import * as z from "zod/v4"
import { deckInput, wholeInput, readInput, inputRefusal, textInput } from "./wire.js"

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
const coordinate = z.int().min(coordinates.lowest).max(coordinates.highest)
const extent = z.int().min(1).max(coordinates.highest)

export const elementReaders = {
  add_text_box: readInput(
    z.strictObject({
      ...head,
      slide,
      box: z
        .strictObject({
          x: coordinate.describe("Left edge from the slide's left edge."),
          y: coordinate.describe("Top edge from the slide's top edge."),
          cx: extent.describe("Width."),
          cy: extent.describe("Height."),
        })
        .exactOptional()
        .describe(
          "The box on the slide in EMU. 914400 EMU is one inch. Leave it out to put the box in the largest free area of the slide.",
        ),
      text: textInput.exactOptional().describe("Opening text for the box. Leave it out for an empty box."),
    }),
    inputRefusal,
  ),
  delete_element: readInput(
    z.strictObject({
      ...head,
      node: z
        .string()
        .regex(elementPattern)
        .transform((value) => elementId(value))
        .describe("Element id, <slide>.<shape>, such as 258.7."),
    }),
    inputRefusal,
  ),
}
export type ElementOp = keyof typeof elementReaders
