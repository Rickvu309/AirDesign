import { fadedColor, opaque, sameColor, type Color } from "@airdesign/document"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import type { ControlProps } from "@/design/panel"
import { cn } from "@/lib/class-names"

const lightest = 0xe0

function light(css: string): boolean {
  const hex = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(css)
  return hex !== null && hex.slice(1).every((pair) => Number.parseInt(pair, 16) >= lightest)
}

export function ColorControl({ row, palette, onChange }: ControlProps) {
  const label = useId()
  const held = row.mixed ? null : (row.value as Color | undefined)
  const shown = held === null || held === undefined ? held : fadedColor(held, opaque)
  return (
    <div className="flex flex-col gap-1.5" data-control="color">
      <span id={label} className="text-[length:var(--type-caption)] text-quiet">
        {row.label}
      </span>
      <div role="group" aria-labelledby={label} className="grid grid-cols-10 gap-1.5">
        {palette.map((swatch) => {
          const color: Color = { scheme: swatch.scheme }
          const chosen = shown !== null && shown !== undefined && sameColor(shown, color)
          return (
            <Button
              key={swatch.scheme}
              type="button"
              variant="ghost"
              aria-label={swatch.name}
              aria-pressed={chosen}
              title={swatch.name}
              onClick={() => {
                if (!chosen) onChange(color)
              }}
              className={cn(
                "aspect-square h-auto w-full rounded-[var(--shape-control)] p-0 active:translate-y-0",
                light(swatch.css) ? "shadow-[0px_0px_0px_1px_var(--field-edge)]" : null,
                chosen ? "shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]" : null,
              )}
              style={{ background: swatch.css }}
            />
          )
        })}
      </div>
    </div>
  )
}
