import {
  coordinates,
  elementId,
  elementPattern,
  limits,
  readBox,
  readElementId,
  type Box,
  type ElementId,
} from "@airdesign/document"
import * as z from "zod/v4"

import { storableText } from "./storable-text.js"
import { readSlideEdit, type WireSlide } from "./slide-wire.js"
import {
  baseRefusal,
  batchRefusal,
  deckInput,
  deckPattern,
  fieldRefusal,
  inputRefusal,
  knownKeys,
  readDeckId,
  readFloor,
  readInput,
  recordOf,
  textInput,
  wholeInput,
  type BaseRefusal,
  type BatchRefusal,
  type DeckId,
  type DeckRefusal,
  type FieldRefusal,
} from "./wire.js"

type Edited = (
  | { readonly value: string; readonly property?: never }
  | { readonly property: "box"; readonly value: Box }
) & {
  readonly node: ElementId
  readonly floor?: string
}

type Unnamed = {
  readonly actor?: never
  readonly command?: never
  readonly principal?: never
  readonly person?: never
  readonly agent?: never
  readonly surface?: never
  readonly onBehalfOf?: never
}

export type WireEdit = Edited & Unnamed & { readonly readAt?: never }

export type WireChange = Edited & Unnamed & { readonly readAt: number }

function readBoxEdit(body: Record<string, unknown>): { ok: true; edit: WireEdit } | FieldRefusal {
  if (body.property !== "box" || !knownKeys(body, ["property", "value", "node", "floor"])) return fieldRefusal
  const value = readBox(body.value)
  const node = readElementId(body.node)
  const floor = readFloor(body)
  if (value === null || node === undefined || floor === null) return fieldRefusal
  if (floor === undefined) return { ok: true, edit: { property: "box", value, node } }
  return { ok: true, edit: { property: "box", value, node, floor } }
}

export function readEdit(raw: unknown): { ok: true; edit: WireEdit } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined) return fieldRefusal
  if (Object.hasOwn(body, "property")) return readBoxEdit(body)
  if (!knownKeys(body, ["value", "node", "floor"]) || !storableText(body.value)) return fieldRefusal
  const node = readElementId(body.node)
  if (node === undefined) return fieldRefusal
  const floor = readFloor(body)
  if (floor === null) return fieldRefusal
  if (floor === undefined) return { ok: true, edit: { value: body.value, node } }
  return { ok: true, edit: { value: body.value, node, floor } }
}

function readCommitEdit(raw: unknown): { ok: true; edit: WireEdit | WireSlide } | FieldRefusal {
  const body = recordOf(raw)
  if (body === undefined) return fieldRefusal
  if (Object.hasOwn(body, "slide")) return readSlideEdit(body)
  return readEdit(raw)
}

function readEditBatch(
  raw: unknown,
): { ok: true; edits: readonly (WireEdit | WireSlide)[] } | FieldRefusal | BatchRefusal {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > limits.batch) return batchRefusal
  const edits: (WireEdit | WireSlide)[] = []
  for (const item of raw) {
    const edit = readCommitEdit(item)
    if (!edit.ok) return fieldRefusal
    edits.push(edit.edit)
  }
  return { ok: true, edits }
}

export function readCommit(
  raw: unknown,
):
  | { ok: true; deck: DeckId; batch: readonly (WireEdit | WireSlide)[]; once?: string }
  | FieldRefusal
  | DeckRefusal
  | BatchRefusal {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "batch", "once"]) || !Object.hasOwn(body, "deck")) {
    return fieldRefusal
  }
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deck
  if (!Object.hasOwn(body, "batch")) return batchRefusal
  const batch = readEditBatch(body.batch)
  if (!batch.ok) return batch
  if (!Object.hasOwn(body, "once")) return { ok: true, deck: deck.deck, batch: batch.edits }
  if (typeof body.once !== "string" || !deckPattern.test(body.once)) return fieldRefusal
  return { ok: true, deck: deck.deck, batch: batch.edits, once: body.once }
}

const nodeInput = z
  .string()
  .regex(elementPattern)
  .transform((value) => elementId(value))
  .describe("Element id, <slide>.<shape>, such as 258.7.")
const readAtInput = wholeInput.describe(
  "Version of that element from airdesign_read_deck. 0 when that read omitted the element.",
)
const coordinateInput = z.int().min(coordinates.lowest).max(coordinates.highest)
const extentInput = z.int().min(0).max(coordinates.highest)
const textChange = z.strictObject({
  value: textInput.describe(
    "Text to write. For an element whose file text is a JSON text value, send a JSON text value: [{from, runs: [{from, text}]}]. Each from is an index the file has, and a run from of -1 is a new run. A run may set bold, italic or underline to true or false, size to a whole number of hundredths of a point from 100 to 400000, and color to {scheme: dk1, lt1, dk2, lt2 or accent1 through accent6} or {rgb: six uppercase hex digits}. A paragraph may set align to left, center or right, and bullet to true or false. Leaving one out keeps the file's.",
  ),
  node: nodeInput,
  readAt: readAtInput,
  floor: textInput.exactOptional(),
})
const boxChange = z.strictObject({
  property: z.literal("box").describe("Send box to move or resize the element instead of writing its text."),
  value: z
    .strictObject({
      x: coordinateInput.describe("Left edge from the slide's left edge."),
      y: coordinateInput.describe("Top edge from the slide's top edge."),
      cx: extentInput.describe("Width."),
      cy: extentInput.describe("Height."),
    })
    .describe("The element's box on the slide in EMU. 914400 EMU is one inch."),
  node: nodeInput,
  readAt: readAtInput,
  floor: textInput.exactOptional(),
})

export const readAgentEdit = readInput(
  z.strictObject({
    deck: deckInput,
    base: wholeInput.describe("Revision from airdesign_read_deck."),
    changes: z
      .array(z.union([textChange, boxChange]))
      .min(1)
      .max(limits.batch)
      .describe("Edits to land."),
  }),
  (issues, raw): FieldRefusal | DeckRefusal | BaseRefusal | BatchRefusal => {
    if (issues.some((issue) => issue.path.length === 0 || issue.path[0] === "deck")) return inputRefusal(issues, raw)
    if (issues.some((issue) => issue.path[0] === "base")) return baseRefusal
    if (issues.some((issue) => issue.path.length === 1 && issue.path[0] === "changes")) return batchRefusal
    return fieldRefusal
  },
)
