import type { Desc } from "@airdesign/document"
import { Fragment } from "react"
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
  const numeric = (desc: Desc) => desc.kind === "number" || desc.kind === "flag"
  const numbers = fields.filter(([, desc]) => numeric(desc))
  const gridded = numbers.length === fields.length || numbers.length > 1
  const rest = gridded ? fields.filter(([, desc]) => !numeric(desc)) : fields
  const titled = row.caption && !row.field.includes(".")
  const part = ([name, desc]: readonly [string, Desc]) => (
    <Fragment key={name}>
      {inner?.({
        row: partRow(row, name, desc, held[name]),
        palette,
        onChange: (next) => onChange({ ...held, ...cleared(fields, name), [name]: next }),
        inner,
      })}
    </Fragment>
  )
  return (
    <div role="group" aria-label={row.label} data-control="record" className="flex flex-col gap-2">
      {titled ? <span className="text-[length:var(--type-dense)] font-medium text-foreground">{row.label}</span> : null}
      {gridded ? <div className="grid grid-cols-2 gap-2">{numbers.map(part)}</div> : null}
      {rest.length === 0 ? null : <div className="flex flex-col gap-3">{rest.map(part)}</div>}
    </div>
  )
}
