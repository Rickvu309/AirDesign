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
}[] = [{ alias: "fill", trait: "fills", fields: { value: "paint" }, cases: { picture: "image" } }]

function plainObject(raw: unknown): raw is Fields {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
}

function renamed(raw: Fields, names: Readonly<Record<string, string>>): Fields {
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [names[key] ?? key, value]))
}

export function canonicalTraits(raw: Fields): Read {
  let body = raw
  for (const { alias, trait, fields, cases } of traitAliases) {
    if (!Object.hasOwn(body, alias)) continue
    if (Object.hasOwn(body, trait)) return { ok: false, field: trait }
    const held = body[alias]
    const named = plainObject(held)
      ? Object.fromEntries(
          Object.entries(renamed(held, fields)).map(([field, value]) => [
            field,
            plainObject(value) ? renamed(value, cases) : value,
          ]),
        )
      : held
    body = Object.fromEntries(
      Object.entries(body).map(([key, value]) => (key === alias ? [trait, named] : [key, value])),
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
