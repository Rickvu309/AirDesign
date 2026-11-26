import { controlLabel } from "@/design/controls/control-label"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { designCopy } from "@/copy/design-copy"
import { partControl, type ControlProps } from "@/design/panel"

export function ListControl({ control, palette, onChange, inner }: ControlProps) {
  const label = useId()
  const desc = control.desc.kind === "list" ? control.desc : null
  const items: readonly unknown[] = Array.isArray(control.value) ? control.value : []
  if (desc === null) return null
  return (
    <div className="flex flex-col gap-2" data-control="list">
      <span id={label} className={controlLabel}>
        {control.label}
      </span>
      <ol aria-labelledby={label} className="flex flex-col gap-2">
        {items.map((item, at) => (
          <li
            key={at}
            className="flex flex-col gap-2 rounded-[var(--shape-control)] bg-white p-2 shadow-[0px_0px_0px_1px_var(--field-edge)]"
          >
            <div className="flex min-h-6 items-center justify-between gap-2">
              <span className="text-[length:var(--type-caption)] font-medium text-foreground">
                {designCopy.stop(at + 1)}
              </span>
              {items.length > desc.min ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="panel-caption"
                  aria-label={designCopy.removeStop(at + 1)}
                  onClick={() => onChange(items.filter((_, each) => each !== at))}
                >
                  {designCopy.remove}
                </Button>
              ) : null}
            </div>
            {inner?.({
              control: { ...partControl(control, String(at), desc.item, item), label: designCopy.stop(at + 1) },
              palette,
              onChange: (next) => onChange(items.map((each, place) => (place === at ? next : each))),
              inner,
            })}
          </li>
        ))}
      </ol>
      {items.length < desc.max ? (
        <Button
          type="button"
          variant="ghost"
          size="panel-caption"
          className="self-start"
          onClick={() => onChange([...items, items.at(-1)])}
        >
          {designCopy.addStop}
        </Button>
      ) : null}
    </div>
  )
}
