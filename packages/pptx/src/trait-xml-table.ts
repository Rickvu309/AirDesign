import { readTableValue, writeTableValue } from "@airdesign/document"
import { readTable, writeTable } from "./table-write.js"
import { whole, type PartCodec, type TraitXml } from "./xml-codec.js"

const tableValue: PartCodec<string> = {
  read(parts, at) {
    try {
      const table = readTable(parts, at.part, at.shape)
      return table === null ? null : writeTableValue(table)
    } catch {
      return null
    }
  },
  write(parts, at, value) {
    const table = readTableValue(value)
    return table === null ? parts : writeTable(parts, at.part, at.shape, table)
  },
}

export const tableXml: TraitXml<"table"> = { slot: null, fields: { value: whole(tableValue) } }
