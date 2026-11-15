import { useId } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ControlProps } from "@/design/panel"

function attached(parent: unknown): string | null {
  if (typeof parent !== "object" || parent === null || !("node" in parent)) return null
  return typeof parent.node === "string" ? parent.node : null
}

export function SiteControl({ row, onChange }: ControlProps) {
  const label = useId()
  const node = attached(row.parent)
  const names = row.nodes?.find((choice) => choice.node === node)?.sites ?? []
  const value = !row.mixed && typeof row.value === "number" && row.value in names ? String(row.value) : null
  return (
    <div className="flex flex-col gap-1.5" data-control="site">
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      <Select
        value={value}
        onValueChange={(next) => {
          const site = Number(next)
          if (typeof next === "string" && Number.isInteger(site) && site !== row.value && site in names) onChange(site)
        }}
      >
        <SelectTrigger
          aria-labelledby={label}
          className="h-8 w-full rounded-lg border-0 bg-white text-[length:var(--type-dense)] shadow-[0px_0px_0px_1px_var(--field-edge)]"
        >
          <SelectValue>
            {(selected: string | null) => (selected === null ? "" : (names[Number(selected)] ?? ""))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {names.map((name, site) => (
            <SelectItem key={name} value={String(site)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
