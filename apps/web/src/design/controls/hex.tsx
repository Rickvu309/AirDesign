import { useId } from "react"
import { Button } from "@/components/ui/button"
import { colorCopy } from "@/copy/color-copy"
import { ColorPicker } from "@/design/color-picker"
import { ColorField, fieldLook } from "@/design/controls/color"
import type { ControlProps } from "@/design/panel"

const hexDigits = /^#?([0-9A-Fa-f]{6})$/

export function HexControl({ row, palette, onChange }: ControlProps) {
  const named = useId()
  const shown = typeof row.value === "string" ? (hexDigits.exec(row.value)?.[1]?.toUpperCase() ?? null) : null
  return (
    <div className="min-w-0" data-control="hex">
      <ColorPicker
        value={shown === null ? undefined : { rgb: shown }}
        palette={palette}
        theme={false}
        onPick={(color) => {
          if ("rgb" in color && color.rgb !== shown) onChange(color.rgb)
        }}
        trigger={
          <Button
            type="button"
            variant="ghost"
            aria-label={row.label}
            title={shown === null ? row.label : `${row.label} ${colorCopy.hexName(shown)}`}
            className={fieldLook}
          />
        }
      >
        <ColorField id={named} css={shown === null ? null : `#${shown}`} name={row.label} disclosure={false} />
      </ColorPicker>
    </div>
  )
}
