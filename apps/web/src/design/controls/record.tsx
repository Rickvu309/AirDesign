import { Fragment } from "react"
import { partRow, type ControlProps } from "@/design/panel"

export function RecordControl({ row, palette, onChange, inner }: ControlProps) {
  const fields = row.desc.kind === "record" ? Object.entries(row.desc.fields) : []
  const held =
    typeof row.value === "object" && row.value !== null ? (row.value as Readonly<Record<string, unknown>>) : {}
  const numbers = fields.every(([, desc]) => desc.kind === "number" || desc.kind === "flag")
  const titled = row.caption && !row.field.includes(".")
  return (
    <div role="group" aria-label={row.label} data-control="record" className="flex flex-col gap-2">
      {titled ? <span className="text-[length:var(--type-dense)] font-medium text-foreground">{row.label}</span> : null}
      <div className={numbers ? "grid grid-cols-2 gap-2" : "flex flex-col gap-3"}>
        {fields.map(([name, desc]) => (
          <Fragment key={name}>
            {inner?.({
              row: partRow(row, name, desc, held[name]),
              palette,
              onChange: (next) => onChange({ ...held, [name]: next }),
              inner,
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
