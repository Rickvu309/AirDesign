type Schema = Readonly<Record<string, unknown>>

const smallest = 120

function plain(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type Use = { count: number; readonly keys: Map<string, number>; readonly first: Schema }
type Group = Use & { readonly worded: Map<string, Use> }
type Seen = Map<string, Group>
type Shared = { readonly name: string; readonly body: Schema; readonly worded: boolean }
type Candidate = Shared & { readonly key: string }

function bare(value: Schema): string {
  const { description: _description, ...body } = value
  return JSON.stringify(body)
}

function tally(use: Use, name: string): void {
  use.count += 1
  use.keys.set(name, (use.keys.get(name) ?? 0) + 1)
}

function fresh(value: Schema): Use {
  return { count: 0, keys: new Map<string, number>(), first: value }
}

function counted(value: unknown, seen: Seen, name: string): void {
  if (Array.isArray(value)) {
    for (const item of value) counted(item, seen, name)
    return
  }
  if (!plain(value)) return
  if (name !== "properties" && !Object.hasOwn(value, "$ref")) {
    const text = bare(value)
    const group = seen.get(text) ?? { ...fresh(value), worded: new Map<string, Use>() }
    const whole = JSON.stringify(value)
    const use = group.worded.get(whole) ?? fresh(value)
    tally(group, name)
    tally(use, name)
    group.worded.set(whole, use)
    seen.set(text, group)
  }
  for (const [key, item] of Object.entries(value)) counted(item, seen, key)
}

function commonKey(keys: ReadonlyMap<string, number>): string {
  return [...keys].sort(([left, many], [right, more]) => more - many || (left < right ? -1 : 1))[0]?.[0] ?? "shared"
}

function candidate(key: string, use: Use, body: Schema, worded: boolean): readonly Candidate[] {
  if (use.count < 2 || JSON.stringify(body).length < smallest) return []
  return [{ key, name: commonKey(use.keys), body, worded }]
}

function candidates(text: string, group: Group): readonly Candidate[] {
  if (group.worded.size === 1) return candidate(`bare ${text}`, group, group.first, true)
  const shared = candidate(`bare ${text}`, group, JSON.parse(text) as Schema, false)
  if (shared.length > 0) return shared
  return [...group.worded].flatMap(([whole, use]) => candidate(`whole ${whole}`, use, use.first, true))
}

function named(seen: Seen, held: readonly string[]): Map<string, Shared> {
  const names = new Map<string, Shared>()
  const taken = new Set<string>(held)
  const shared = [...seen]
    .flatMap(([text, group]) => candidates(text, group))
    .sort((left, right) => JSON.stringify(right.body).length - JSON.stringify(left.body).length)
  for (const { key, name, body, worded } of shared) {
    const base = /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : "shared"
    let chosen = base
    for (let copy = 2; taken.has(chosen); copy += 1) chosen = `${base}${String(copy)}`
    taken.add(chosen)
    names.set(key, { name: chosen, body, worded })
  }
  return names
}

function referenced(value: unknown, names: ReadonlyMap<string, Shared>, inside: string | null): unknown {
  if (Array.isArray(value)) return value.map((item) => referenced(item, names, inside))
  if (!plain(value)) return value
  const found = names.get(`bare ${bare(value)}`) ?? names.get(`whole ${JSON.stringify(value)}`)
  if (found !== undefined && found.name !== inside) {
    const words = found.worded || value.description === undefined ? {} : { description: value.description }
    return { $ref: `#/$defs/${found.name}`, ...words }
  }
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
    [...names.values()].map((found) => [found.name, referenced(found.body, names, found.name)]),
  )
  return { ...(referenced(body, names, null) as Schema), $defs: { ...held, ...defs } }
}

const local = "#/$defs/"

function inlined(value: unknown, defs: Schema): unknown {
  if (Array.isArray(value)) return value.map((item) => inlined(item, defs))
  if (!plain(value)) return value
  const reference = value.$ref
  const body = Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => (key === "$ref" ? [] : [[key, inlined(item, defs)]])),
  )
  const target =
    typeof reference === "string" && reference.startsWith(local) ? defs[reference.slice(local.length)] : undefined
  if (plain(target)) return { ...(inlined(target, defs) as Schema), ...body }
  return reference === undefined ? body : { $ref: reference, ...body }
}

export function inlinedSchema(schema: Schema): Schema {
  const { $defs: given, ...body } = schema
  return inlined(body, plain(given) ? given : {}) as Schema
}
