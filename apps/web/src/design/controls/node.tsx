import { controlLabel } from "@/design/controls/control-label"
import { useId } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ControlProps } from "@/design/panel"

export function NodeControl({ control, onChange }: ControlProps) {
  const label = useId()
  const choices = control.nodes ?? []
  const value = !control.mixed && typeof control.value === "string" ? control.value : null
  const nameOf = (node: string | null) => choices.find((choice) => choice.node === node)?.name ?? node ?? ""
  return (
    <div className="flex flex-col gap-1" data-control="node">
      <span id={label} className={controlLabel}>
        {control.label}
      </span>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string" && next !== value && choices.some((choice) => choice.node === next))
            onChange(next)
        }}
      >
        <SelectTrigger
          aria-labelledby={label}
          className="h-[var(--control-dense)] w-full rounded-[var(--shape-control)] border-0 bg-white text-[length:var(--type-caption)] shadow-[inset_0px_0px_0px_1px_var(--field-edge)] data-[size=default]:h-[var(--control-dense)]"
        >
          <SelectValue>{(selected: string | null) => nameOf(selected)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.node} value={choice.node}>
              {choice.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
