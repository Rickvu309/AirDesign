type Fields = Readonly<Record<string, unknown>>

type Read = { readonly ok: true; readonly fields: Fields } | { readonly ok: false; readonly field: string }

const opAliases: readonly { readonly ops: readonly string[]; readonly alias: string; readonly field: string }[] = [
  { ops: ["add_slide", "move_slides"], alias: "row", field: "group" },
]

export function canonicalOpFields(op: string, raw: Fields): Read {
  let fields = raw
  for (const { alias, field } of opAliases.filter((each) => each.ops.includes(op))) {
    if (!Object.hasOwn(fields, alias)) continue
    if (Object.hasOwn(fields, field)) return { ok: false, field }
    fields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key === alias ? field : key, value]))
  }
  return { ok: true, fields }
}
