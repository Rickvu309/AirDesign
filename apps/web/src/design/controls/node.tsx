import { useId } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ControlProps } from "@/design/panel"

export function NodeControl({ row, onChange }: ControlProps) {
  const label = useId()
  const choices = row.nodes ?? []
  const value = !row.mixed && typeof row.value === "string" ? row.value : null
  const nameOf = (node: string | null) => choices.find((choice) => choice.node === node)?.name ?? node ?? ""
  return (
    <div className="flex flex-col gap-1.5" data-control="node">
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
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
          className="h-8 w-full rounded-lg border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
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
