import type { ControlProps } from "@/design/panel"
import { pictureCopy } from "@/copy/picture-copy"
import { IconSearch } from "@/editor/icon-search"

export function AssetControl({ control, onChange }: ControlProps) {
  const current = typeof control.value === "string" ? control.value : null
  return (
    <div className="flex flex-col gap-2" data-control="asset">
      <p className="text-[length:var(--type-dense)] text-quiet">
        {current === null ? pictureCopy.raster : pictureCopy.current(current)}
      </p>
      <IconSearch label={control.label} current={current} waits={current === null} onPick={(name) => onChange(name)} />
    </div>
  )
}
