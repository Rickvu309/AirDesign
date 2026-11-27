import * as z from "zod/v4"

import { readDeckName } from "./deck-name.js"
import { fieldRefusal, readInput } from "./wire.js"

const readFields = readInput(
  z.strictObject({ name: z.string().exactOptional(), style: z.string().exactOptional() }),
  () => fieldRefusal,
)

export const readCreateDeck = Object.assign(
  (raw: unknown) => {
    const fields = readFields(raw)
    if (!fields.ok) return fields
    if (fields.name === undefined) return { ok: true as const, name: undefined, style: fields.style }
    const name = readDeckName(fields.name)
    if (name === undefined) return { ...fieldRefusal, field: "name", fault: "form" as const }
    return { ok: true as const, name, style: fields.style }
  },
  { input: readFields.input },
)
