import { Button } from "@/components/ui/button"
import { frameCopy } from "@/copy/frame-copy"
import { controlLabel } from "@/design/controls/control-label"
import { IndividualPadding } from "@/design/layout-icons"
import { partControl, type ControlProps } from "@/design/panel"
import { useState } from "react"

const horizontal = ["left", "right"] as const
const vertical = ["top", "bottom"] as const
const sides = ["left", "top", "right", "bottom"] as const

export function PaddingControl({ control, palette, onChange, inner }: ControlProps) {
  const [individual, setIndividual] = useState(false)
  if (control.desc.kind !== "record") return null
  const fields = control.desc.fields
  const held: Readonly<Record<string, unknown>> = Object.fromEntries(
    typeof control.value === "object" && control.value !== null ? Object.entries(control.value) : [],
  )

  function field(name: string, targets: readonly [string, ...string[]]) {
    const desc = fields[targets[0]]
    if (desc === undefined) return null
    const current = held[targets[0]]
    const mixed = control.mixed || targets.some((side) => held[side] !== current)
    return (
      <div key={name} className="min-w-0">
        {inner?.({
          control: { ...partControl(control, name, desc, current), mixed, value: mixed ? undefined : current },
          palette,
          inner,
          onChange: (next) => onChange({ ...held, ...Object.fromEntries(targets.map((side) => [side, next])) }),
        })}
      </div>
    )
  }

  return (
    <div role="group" aria-label={control.label} data-control="record" className="flex flex-col gap-1">
      <span className={controlLabel}>{control.label}</span>
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          {individual
            ? sides.map((side) => field(side, [side]))
            : [field("horizontal", horizontal), field("vertical", vertical)]}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-[var(--control-dense)] rounded-[var(--shape-control)] aria-pressed:bg-pressed aria-pressed:text-primary-strong active:translate-y-0"
          aria-pressed={individual}
          aria-label={frameCopy.individualPadding}
          title={frameCopy.individualPadding}
          onClick={() => setIndividual(!individual)}
        >
          <IndividualPadding aria-hidden />
        </Button>
      </div>
    </div>
  )
}
