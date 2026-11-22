import { doom } from "@airdesign/document"
import * as z from "zod/v4"

import { readDeckName } from "./deck-name.js"
import { fieldRefusal, readInput } from "./wire.js"

export const blankDeckName = doom.blankDeckName

const readFields = readInput(
  z.strictObject({ name: z.string().describe("The deck's name. Left out: Blank deck.").exactOptional() }),
  () => fieldRefusal,
)

export const readCreateDeck = Object.assign(
  (raw: unknown) => {
    const fields = readFields(raw)
    if (!fields.ok) return fields
    const name = fields.name === undefined ? blankDeckName : readDeckName(fields.name)
    return name === undefined ? fieldRefusal : { ok: true as const, name }
  },
  { input: readFields.input },
)
