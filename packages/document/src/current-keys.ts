import { namesAlias } from "./key-alias.js"
import { readTextValue, writeTextValue } from "./text-value.js"

export function withCurrentKeys(value: string): string {
  if (!namesAlias(value)) return value
  const text = readTextValue(value)
  return text === null ? value : writeTextValue(text)
}
