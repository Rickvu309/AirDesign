type Schema = Readonly<Record<string, unknown>>

function plain(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type Use = { count: number; readonly keys: Map<string, number>; readonly first: Schema }
type Group = Use & { readonly worded: Map<string, Use> }
type Seen = Map<string, Group>
type Candidate = {
  readonly key: string
  readonly name: string
  readonly body: Schema
  readonly worded: boolean
  readonly saved: number
}

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

function saving(use: Use, body: Schema, name: string): number {
  const size = JSON.stringify(body).length
  const reference = JSON.stringify({ $ref: `#/$defs/${name}` }).length
  return use.count * (size - reference) - size - name.length - 3
}

function candidate(key: string, use: Use, body: Schema, worded: boolean): readonly Candidate[] {
  if (use.count < 2) return []
  const name = commonKey(use.keys)
  const saved = saving(use, body, name)
  return saved > 0 ? [{ key, name, body, worded, saved }] : []
}

function candidates(text: string, group: Group): readonly Candidate[] {
  if (group.worded.size === 1) return candidate(`bare ${text}`, group, group.first, true)
  const shared = candidate(`bare ${text}`, group, JSON.parse(text) as Schema, false)
  if (shared.length > 0) return shared
  return [...group.worded].flatMap(([whole, use]) => candidate(`whole ${whole}`, use, use.first, true))
}

function best(seen: Seen): Candidate | undefined {
  return [...seen]
    .flatMap(([text, group]) => candidates(text, group))
    .sort((left, right) => right.saved - left.saved)[0]
}

function freeName(name: string, taken: Schema): string {
  const base = /^[A-Za-z][A-Za-z0-9]*$/.test(name) ? name : "shared"
  let chosen = base
  for (let copy = 2; Object.hasOwn(taken, chosen); copy += 1) chosen = `${base}${String(copy)}`
  return chosen
}

function referenced(value: unknown, found: Candidate, inside: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => referenced(item, found, false))
  if (!plain(value)) return value
  const matches = found.key === `bare ${bare(value)}` || found.key === `whole ${JSON.stringify(value)}`
  if (matches && !inside) {
    const words = found.worded || value.description === undefined ? {} : { description: value.description }
    return { $ref: `#/$defs/${found.name}`, ...words }
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, referenced(item, found, false)]))
}

function sharedOnce(schema: Schema): Schema | null {
  const { $defs: given, ...body } = schema
  const held: Schema = plain(given) ? given : {}
  const seen: Seen = new Map()
  counted(body, seen, "shared")
  for (const [name, def] of Object.entries(held)) counted(def, seen, name)
  const found = best(seen)
  if (found === undefined) return null
  const named = { ...found, name: freeName(found.name, held) }
  const defs = Object.fromEntries(Object.entries(held).map(([name, def]) => [name, referenced(def, named, false)]))
  return {
    ...(referenced(body, named, false) as Schema),
    $defs: { ...defs, [named.name]: referenced(named.body, named, true) },
  }
}

export function sharedSchemas(schema: Schema): Schema {
  let shared = schema
  for (let next = sharedOnce(shared); next !== null; next = sharedOnce(shared)) shared = next
  return shared
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
