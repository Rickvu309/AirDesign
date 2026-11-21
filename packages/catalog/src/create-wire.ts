import { blankTemplate, deckTemplates } from "@airdesign/templates"
import * as z from "zod/v4"

import { readDeckName } from "./deck-name.js"
import { fieldRefusal, readInput } from "./wire.js"

export const blankDeckName = "Blank deck"

const readFields = readInput(
  z.strictObject({
    name: z.string().exactOptional(),
    template: z.enum(deckTemplates.map((template) => template.id)).exactOptional(),
  }),
  () => fieldRefusal,
)

export const readCreateDeck = Object.assign(
  (raw: unknown) => {
    const fields = readFields(raw)
    if (!fields.ok) return fields
    const name = fields.name === undefined ? blankDeckName : readDeckName(fields.name)
    return name === undefined ? fieldRefusal : { ok: true as const, name, template: fields.template ?? blankTemplate }
  },
  { input: readFields.input },
)
