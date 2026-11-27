import * as doom from "@airdesign/doom"
import * as z from "zod/v4"

import { readDeckName } from "./deck-name.js"
import { fieldRefusal, readInput } from "./wire.js"

export const blankDeckName = doom.blankDeckName

const readFields = readInput(
  z.strictObject({ name: z.string().exactOptional(), theme: z.string().exactOptional() }),
  () => fieldRefusal,
)

export const readCreateDeck = Object.assign(
  (raw: unknown) => {
    const fields = readFields(raw)
    if (!fields.ok) return fields
    const name = fields.name === undefined ? blankDeckName : readDeckName(fields.name)
    if (name === undefined) return { ...fieldRefusal, field: "name", fault: "form" as const }
    return { ok: true as const, name, theme: fields.theme }
  },
  { input: readFields.input },
)
