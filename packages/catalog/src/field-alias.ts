import type { TraitName } from "@airdesign/document"

type Fields = Readonly<Record<string, unknown>>

const fieldAliases: readonly { readonly trait: TraitName; readonly alias: string; readonly field: string }[] = [
  { trait: "text", alias: "lineHeight", field: "lineSpacing" },
]

export function canonicalFields(
  trait: TraitName,
  raw: Fields,
): { readonly ok: true; readonly fields: Fields } | { readonly ok: false; readonly field: string } {
  let fields = raw
  for (const { alias, field } of fieldAliases.filter((each) => each.trait === trait)) {
    if (!Object.hasOwn(fields, alias)) continue
    if (Object.hasOwn(fields, field)) return { ok: false, field: `${trait}.${field}` }
    fields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key === alias ? field : key, value]))
  }
  return { ok: true, fields }
}
