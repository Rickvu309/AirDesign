type Schema = Readonly<Record<string, unknown>>

const smallest = 160

function plain(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type Seen = Map<string, { count: number; keys: Map<string, number> }>

function counted(value: unknown, seen: Seen, name: string): void {
  if (Array.isArray(value)) {
    for (const item of value) counted(item, seen, name)
    return
  }
  if (!plain(value)) return
  const text = JSON.stringify(value)
  if (text.length >= smallest && name !== "properties" && !Object.hasOwn(value, "$ref")) {
    const known = seen.get(text) ?? { count: 0, keys: new Map<string, number>() }
    known.keys.set(name, (known.keys.get(name) ?? 0) + 1)
    seen.set(text, { count: known.count + 1, keys: known.keys })
  }
  for (const [key, item] of Object.entries(value)) counted(item, seen, key)
}

function commonKey(keys: ReadonlyMap<string, number>): string {
  return [...keys].sort(([left, many], [right, more]) => more - many || (left < right ? -1 : 1))[0]?.[0] ?? "shared"
}

function named(seen: Seen, held: readonly string[]): Map<string, string> {
  const names = new Map<string, string>()
  const taken = new Set<string>(held)
  const shared = [...seen].filter(([, { count }]) => count > 1).sort(([left], [right]) => right.length - left.length)
  for (const [text, { keys }] of shared) {
    const name = commonKey(keys)
    const base = /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : "shared"
    let chosen = base
    for (let copy = 2; taken.has(chosen); copy += 1) chosen = `${base}${String(copy)}`
    taken.add(chosen)
    names.set(text, chosen)
  }
  return names
}

function referenced(value: unknown, names: ReadonlyMap<string, string>, inside: string | null): unknown {
  if (Array.isArray(value)) return value.map((item) => referenced(item, names, inside))
  if (!plain(value)) return value
  const name = names.get(JSON.stringify(value))
  if (name !== undefined && name !== inside) return { $ref: `#/$defs/${name}` }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, referenced(item, names, inside)]))
}

export function sharedSchemas(schema: Schema): Schema {
  const { $defs: given, ...body } = schema
  const held: Schema = plain(given) ? given : {}
  const seen: Seen = new Map()
  counted(body, seen, "shared")
  const names = named(seen, Object.keys(held))
  if (names.size === 0) return schema
  const defs = Object.fromEntries(
    [...names].map(([text, name]) => [name, referenced(JSON.parse(text) as unknown, names, name)]),
  )
  return { ...(referenced(body, names, null) as Schema), $defs: { ...held, ...defs } }
}
