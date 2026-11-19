import { useId } from "react"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/design/color-picker"
import { ColorField, fieldLook } from "@/design/controls/color"
import { cn } from "@/lib/class-names"
import type { ControlProps } from "@/design/panel"

const hexDigits = /^#?([0-9A-Fa-f]{6})$/

export function HexControl({ control, palette, onChange }: ControlProps) {
  const named = useId()
  const shown = typeof control.value === "string" ? (hexDigits.exec(control.value)?.[1]?.toUpperCase() ?? null) : null
  return (
    <div className="min-w-0" data-control="hex">
      <ColorPicker
        title={control.label}
        value={shown === null ? undefined : { rgb: shown }}
        palette={palette}
        showTemplateColors={false}
        onPick={(color) => {
          if ("rgb" in color && color.rgb !== shown) onChange(color.rgb)
        }}
        trigger={
          <Button
            type="button"
            variant="ghost"
            aria-label={control.label}
            title={shown === null ? control.label : `${control.label} ${shown}`}
            className={cn(fieldLook, "gap-1 px-1")}
          />
        }
      >
        <ColorField id={named} css={shown === null ? null : `#${shown}`} name={control.label} disclosure={false} />
      </ColorPicker>
    </div>
  )
}
