import type { ControlProps } from "@/design/panel"
import { pictureCopy } from "@/copy/picture-copy"
import { IconSearch } from "@/editor/icon-search"

export function AssetControl({ row, onChange }: ControlProps) {
  const current = typeof row.value === "string" ? row.value : null
  return (
    <div className="flex flex-col gap-2" data-control="asset">
      <p className="text-[length:var(--type-dense)] text-quiet">
        {current === null ? pictureCopy.raster : pictureCopy.current(current)}
      </p>
      <IconSearch label={row.label} current={current} waits={current === null} onPick={(name) => onChange(name)} />
    </div>
  )
}
