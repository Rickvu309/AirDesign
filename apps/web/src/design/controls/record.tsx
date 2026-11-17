import type { Desc } from "@airdesign/document"
import { arrange } from "@/design/panel-arrangement"
import { partRow, type ControlProps } from "@/design/panel"

function cleared(fields: readonly (readonly [string, Desc])[], changed: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    fields.filter(([name, desc]) => name !== changed && desc.kind === "named").map(([name]) => [name, {}]),
  )
}

export function RecordControl({ row, palette, onChange, inner }: ControlProps) {
  const fields = row.desc.kind === "record" ? Object.entries(row.desc.fields) : []
  const held =
    typeof row.value === "object" && row.value !== null ? (row.value as Readonly<Record<string, unknown>>) : {}
  const strips = arrange(
    row.trait,
    fields.map(([name, desc]) => partRow(row, name, desc, held[name])),
  )
  const titled = row.look.name.show === "above"
  const part = (each: typeof row) => {
    const name = each.field.slice(row.field.length + 1)
    return inner?.({
      row: each,
      palette,
      onChange: (next) => onChange({ ...held, ...cleared(fields, name), [name]: next }),
      inner,
    })
  }
  return (
    <div role="group" aria-label={row.label} data-control="record" className="flex flex-col gap-2">
      {titled ? <span className="text-[length:var(--type-dense)] font-medium text-foreground">{row.label}</span> : null}
      {strips.map((strip) => (
        <div
          key={strip.map((each) => each.field).join(" ")}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}
        >
          {strip.map((each) => (
            <div key={each.field}>{part(each)}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
