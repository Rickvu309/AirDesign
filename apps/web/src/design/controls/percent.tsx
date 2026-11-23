import { controlLabel } from "@/design/controls/control-label"
import { shownInUnit, storedOf } from "@/design/typed-number"
import { designCopy } from "@/copy/design-copy"
import { opacityCopy } from "@/copy/opacity-copy"
import { NumberField } from "@/design/controls/number"
import type { ControlProps } from "@/design/panel"

export function PercentControl(props: ControlProps) {
  if (props.control.look.slider === true) return <PercentSlider {...props} />
  return <NumberField {...props} unit={designCopy.percent} kind="percent" />
}

function PercentSlider({ control, onChange, palette }: ControlProps) {
  const shown =
    control.mixed || control.desc.kind !== "number" || typeof control.value !== "number"
      ? 100
      : shownInUnit(control.desc.unit, control.value)
  const field = {
    ...control,
    label: opacityCopy.shadow,
    look: { ...control.look, name: { show: "hidden" as const }, slider: undefined, steps: undefined },
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={controlLabel}>{control.label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label={opacityCopy.slider}
          value={shown}
          onChange={(event) => {
            const read = storedOf(control.desc, Number(event.target.value))
            if (read !== null && (read !== control.value || control.inherited)) onChange(read)
          }}
          className="h-1 min-w-0 flex-1 cursor-pointer accent-foreground"
        />
        <div className="w-20 shrink-0">
          <NumberField control={field} palette={palette} onChange={onChange} unit={designCopy.percent} kind="percent" />
        </div>
      </div>
    </div>
  )
}
