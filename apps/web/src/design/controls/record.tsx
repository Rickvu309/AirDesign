import { Fragment } from "react"
import { PaddingControl } from "@/design/controls/padding"
import { GradientHandles } from "@/design/controls/gradient-handles"
import type { Desc, Paint } from "@airdesign/document"
import { arrange } from "@/design/panel-arrangement"
import { partControl, type ControlProps } from "@/design/panel"

function cleared(fields: readonly (readonly [string, Desc])[], changed: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    fields.filter(([name, desc]) => name !== changed && desc.kind === "named").map(([name]) => [name, {}]),
  )
}

export function RecordControl(props: ControlProps) {
  const { control, palette, onChange, inner } = props
  if (control.trait === "layout" && control.field === "padding") return <PaddingControl {...props} />

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
  const gradient =
    control.field.endsWith(".gradient") && "shade" in held && "stops" in held
      ? (held as Extract<Paint, { gradient: unknown }>["gradient"])
      : null
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
        <span className="text-[length:var(--type-caption)] font-medium text-foreground">{control.label}</span>
      ) : null}
      {strips.map((strip) => (
        <Fragment key={strip.map((each) => each.field).join(" ")}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}>
            {strip.map((each) => (
              <div key={each.field}>{part(each)}</div>
            ))}
          </div>
          {gradient !== null && strip.some((each) => each.field === `${control.field}.shade`) ? (
            <GradientHandles gradient={gradient} palette={palette} onChange={onChange} />
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}
