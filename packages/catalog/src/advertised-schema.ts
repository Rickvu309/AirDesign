import { colorPattern } from "./agent-color.js"
import { unstorable } from "./storable-text.js"

type Schema = Readonly<Record<string, unknown>>

const shortList = 10
const sanityBound = 1_000_000
const namedMaps: ReadonlySet<string> = new Set(["properties", "$defs", "patternProperties"])

function plain(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readerOnly(key: string, value: unknown, outermost: boolean): boolean {
  switch (key) {
    case "maxLength":
    case "minProperties":
    case "uniqueItems":
      return true
    case "maxProperties":
      return value !== 1
    case "maxItems":
      return !outermost && typeof value === "number" && value > shortList
    case "minimum":
    case "maximum":
      return typeof value === "number" && Math.abs(value) >= sanityBound
    case "pattern":
      return (
        typeof value === "string" &&
        (value.includes(unstorable.source) || (value.includes(colorPattern) && value !== `^${colorPattern}$`))
      )
    default:
      return false
  }
}

function trimmed(value: unknown, outermost: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => trimmed(item, false))
  if (!plain(value)) return value
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (readerOnly(key, item, outermost)) return []
      if (namedMaps.has(key) && plain(item)) {
        return [[key, Object.fromEntries(Object.entries(item).map(([name, each]) => [name, trimmed(each, false)]))]]
      }
      return [[key, trimmed(item, false)]]
    }),
  )
}

export function advertisedSchema(schema: Schema): Schema {
  const { properties, ...rest } = schema
  const top = trimmed(rest, false) as Schema
  if (!plain(properties)) return top
  const fields = Object.entries(properties).map(([name, field]) => [name, trimmed(field, name === "changes")])
  return { ...top, properties: Object.fromEntries(fields) }
}
