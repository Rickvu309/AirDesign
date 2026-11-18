import type { TraitName } from "@airdesign/document"

type Fields = Readonly<Record<string, unknown>>

type Read = { readonly ok: true; readonly fields: Fields } | { readonly ok: false; readonly field: string }

const fieldAliases: readonly { readonly trait: TraitName; readonly alias: string; readonly field: string }[] = [
  { trait: "text", alias: "lineSpacing", field: "lineHeight" },
]

const traitAliases: readonly {
  readonly alias: string
  readonly trait: TraitName
  readonly fields: Readonly<Record<string, string>>
  readonly cases: Readonly<Record<string, string>>
}[] = [
  { alias: "fill", trait: "fills", fields: { value: "paint" }, cases: { picture: "image" } },
  { alias: "image", trait: "fills", fields: {}, cases: {} },
  { alias: "crop", trait: "fills", fields: { rect: "crop" }, cases: {} },
  { alias: "line", trait: "border", fields: {}, cases: {} },
]

function plainObject(raw: unknown): raw is Fields {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

function renamed(raw: Fields, names: Readonly<Record<string, string>>): Fields {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [names[key] ?? key, value]))
}

function aliasFields(held: unknown, fields: Readonly<Record<string, string>>, cases: Readonly<Record<string, string>>) {
  if (!plainObject(held)) return held
  return Object.fromEntries(
    Object.entries(renamed(held, fields)).map(([field, value]) => [
      field,
      plainObject(value) ? renamed(value, cases) : value,
    ]),
  )
}

type Joined = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly field: string }

function joined(trait: TraitName, held: unknown, named: unknown): Joined {
  if (held === undefined) return { ok: true, value: named }
  if (!plainObject(held) || !plainObject(named)) return { ok: false, field: trait }
  const twice = Object.keys(named).find((field) => Object.hasOwn(held, field))
  if (twice !== undefined) return { ok: false, field: `${trait}.${twice}` }
  return { ok: true, value: { ...held, ...named } }
}

export function canonicalTraits(raw: Fields): Read {
  let body = raw
  for (const { alias, trait, fields, cases } of traitAliases) {
    if (!Object.hasOwn(body, alias)) continue
    const join = joined(trait, body[trait], aliasFields(body[alias], fields, cases))
    if (!join.ok) return join
    const at = Object.hasOwn(body, trait) ? trait : alias
    body = Object.fromEntries(
      Object.entries(body).flatMap(([key, held]): [string, unknown][] => {
        if (key === at) return [[trait, join.value]]
        return key === alias || key === trait ? [] : [[key, held]]
      }),
    )
  }
  return { ok: true, fields: body }
}

export function canonicalFields(trait: TraitName, raw: Fields): Read {
  let fields = raw
  for (const { alias, field } of fieldAliases.filter((each) => each.trait === trait)) {
    if (!Object.hasOwn(fields, alias)) continue
    if (Object.hasOwn(fields, field)) return { ok: false, field: `${trait}.${field}` }
    fields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key === alias ? field : key, value]))
  }
  return { ok: true, fields }
}
