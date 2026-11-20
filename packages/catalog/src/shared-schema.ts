type Schema = Readonly<Record<string, unknown>>

const local = "#/$defs/"

function plain(value: unknown): value is Schema {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function bare(value: Schema): Schema {
  const { description: _description, ...body } = value
  return body
}

function size(value: unknown): number {
  return JSON.stringify(value).length
}

type Use = {
  readonly body: Schema
  readonly keys: Map<string, number>
  readonly worded: Map<unknown, number>
}

type Pick = { readonly text: string; readonly name: string; readonly def: Schema; readonly words: unknown }

function tallied(value: unknown, uses: Map<string, Use>, key: string): void {
  if (Array.isArray(value)) {
    for (const item of value) tallied(item, uses, key)
    return
  }
  if (!plain(value)) return
  if (!Object.hasOwn(value, "$ref")) {
    const body = bare(value)
    const text = JSON.stringify(body)
    const use = uses.get(text) ?? { body, keys: new Map<string, number>(), worded: new Map<unknown, number>() }
    use.keys.set(key, (use.keys.get(key) ?? 0) + 1)
    use.worded.set(value.description, (use.worded.get(value.description) ?? 0) + 1)
    uses.set(text, use)
  }
  within(value, uses)
}

function within(value: Schema, uses: Map<string, Use>): void {
  for (const [key, item] of Object.entries(value)) {
    if (key !== "properties" || !plain(item)) tallied(item, uses, key)
    else for (const [name, each] of Object.entries(item)) tallied(each, uses, name)
  }
}

function commonKey(keys: ReadonlyMap<string, number>): string {
  return [...keys].sort(([left, many], [right, more]) => more - many || (left < right ? -1 : 1))[0]?.[0] ?? "shared"
}

function freeName(key: string, taken: ReadonlySet<string>): string {
  const base = /^[A-Za-z][A-Za-z0-9]*$/.test(key) ? key : "shared"
  let chosen = base
  for (let copy = 2; taken.has(chosen); copy += 1) chosen = `${base}${String(copy)}`
  return chosen
}

function pointer(pick: Pick, description: unknown): Schema {
  return description === undefined || description === pick.words
    ? { $ref: `${local}${pick.name}` }
    : { $ref: `${local}${pick.name}`, description }
}

function commonWords(worded: ReadonlyMap<unknown, number>): unknown {
  if (worded.has(undefined)) return undefined
  const [words, count] = [...worded].sort(([, many], [, more]) => more - many)[0] ?? [undefined, 0]
  return count > 1 ? words : undefined
}

function worded(body: Schema, description: unknown): Schema {
  return description === undefined ? body : { ...body, description }
}

function saving(pick: Pick, use: Use): number {
  let saved = -(size(pick.name) + size(pick.def) + 2)
  for (const [description, count] of use.worded) {
    saved += count * (size(worded(use.body, description)) - size(pointer(pick, description)))
  }
  return saved
}

function best(body: Schema, defs: Schema): Pick | undefined {
  const uses = new Map<string, Use>()
  within(body, uses)
  for (const def of Object.values(defs)) if (plain(def)) within(def, uses)
  const taken = new Set(Object.keys(defs))
  let chosen: { readonly pick: Pick; readonly saved: number } | undefined
  for (const [text, use] of uses) {
    const words = commonWords(use.worded)
    const pick = { text, name: freeName(commonKey(use.keys), taken), words, def: worded(use.body, words) }
    const saved = saving(pick, use)
    if (saved > 0 && (chosen === undefined || saved > chosen.saved)) chosen = { pick, saved }
  }
  return chosen?.pick
}

function replaced(value: unknown, pick: Pick): unknown {
  if (Array.isArray(value)) return value.map((item) => replaced(item, pick))
  if (!plain(value)) return value
  if (!Object.hasOwn(value, "$ref") && JSON.stringify(bare(value)) === pick.text) {
    return pointer(pick, value.description)
  }
  return replacedWithin(value, pick)
}

function replacedWithin(value: Schema, pick: Pick): Schema {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key === "properties" && plain(item)
        ? Object.fromEntries(Object.entries(item).map(([name, each]) => [name, replaced(each, pick)]))
        : replaced(item, pick),
    ]),
  )
}

export function sharedSchemas(schema: Schema): Schema {
  const { $defs: given, ...rest } = schema
  let body: Schema = rest
  let defs: Schema = plain(given) ? given : {}
  let shared = false
  for (let pick = best(body, defs); pick !== undefined; pick = best(body, defs)) {
    const chosen = pick
    body = replacedWithin(body, chosen)
    const kept = Object.entries(defs).map(([name, def]) => [name, plain(def) ? replacedWithin(def, chosen) : def])
    defs = { ...Object.fromEntries(kept), [chosen.name]: chosen.def }
    shared = true
  }
  return shared ? { ...body, $defs: defs } : schema
}

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
