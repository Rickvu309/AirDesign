import { resolveControl } from "@/design/panel-arrangement"
import { adjustDefaults } from "@airdesign/render"
import { geometryCopy } from "@/copy/geometry-copy"
import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

const adjustStep = 1_000

function presetOf(parent: unknown): string | null {
  if (typeof parent !== "object" || parent === null || !("preset" in parent)) return null
  return typeof parent.preset === "string" ? parent.preset : null
}

export function AdjustControl({ control, palette, onChange }: ControlProps) {
  const preset = presetOf(control.parent)
  const defaults = preset === null ? {} : adjustDefaults(preset)
  const names = Object.keys(defaults)
  const held =
    typeof control.value === "object" && control.value !== null
      ? (control.value as Readonly<Record<string, number>>)
      : {}
  if (control.desc.kind !== "named" || names.length === 0) return null
  const item = control.desc.item
  return (
    <div role="group" aria-label={control.label} data-control="adjust" className="grid grid-cols-1 gap-2">
      {names.map((name) => (
        <NumberField
          key={name}
          control={resolveControl({
            ...control,
            field: `${control.field}.${name}`,
            label: geometryCopy.adjust(name),
            desc: item,
            value: held[name] ?? defaults[name],
          })}
          palette={palette}
          onChange={(next) => onChange({ ...held, [name]: next })}
          unit=""
          kind="count"
          step={adjustStep}
        />
      ))}
    </div>
  )
}
