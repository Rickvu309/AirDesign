import type { Desc } from "@airdesign/document"
import { arrange } from "@/design/panel-arrangement"
import { partControl, type ControlProps } from "@/design/panel"

function cleared(fields: readonly (readonly [string, Desc])[], changed: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    fields.filter(([name, desc]) => name !== changed && desc.kind === "named").map(([name]) => [name, {}]),
  )
}

export function RecordControl({ control, palette, onChange, inner }: ControlProps) {
  const fields = control.desc.kind === "record" ? Object.entries(control.desc.fields) : []
  const held =
    typeof control.value === "object" && control.value !== null
      ? (control.value as Readonly<Record<string, unknown>>)
      : {}
  const strips = arrange(
    control.trait,
    fields.map(([name, desc]) => partControl(control, name, desc, held[name])),
  )
  const titled = control.look.name.show === "above"
  const part = (each: typeof control) => {
    const name = each.field.slice(control.field.length + 1)
    return inner?.({
      control: each,
      palette,
      onChange: (next) => onChange({ ...held, ...cleared(fields, name), [name]: next }),
      inner,
    })
  }
  return (
    <div role="group" aria-label={control.label} data-control="record" className="flex flex-col gap-2">
      {titled ? (
        <span className="text-[length:var(--type-dense)] font-medium text-foreground">{control.label}</span>
      ) : null}
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
