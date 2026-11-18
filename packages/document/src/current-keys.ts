import { namesAlias } from "./key-alias.js"
import { readTableValue, writeTableValue } from "./table-value.js"
import { readTextValue, writeTextValue } from "./text-value.js"

export function withCurrentKeys(value: string): string {
  if (!namesAlias(value)) return value
  const text = readTextValue(value)
  if (text !== null) return writeTextValue(text)
  const table = readTableValue(value)
  return table === null ? value : writeTableValue(table)
}
