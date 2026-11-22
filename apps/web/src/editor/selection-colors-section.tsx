import { Target } from "lucide-react"
import { useId } from "react"
import type { Color } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { selectionColorsCopy } from "@/copy/selection-colors-copy"
import { shownName, type Palette } from "@/design/color-choices"
import { ColorPicker } from "@/design/color-picker"
import { ColorField, fieldLook } from "@/design/controls/color"
import { selectionColors, type ColorSource } from "@/design/selection-colors"
import { DesignSection } from "./design-panel"

export function SelectionColorsSection({
  sources,
  palette,
  onPick,
  onSelect,
}: {
  sources: readonly ColorSource[]
  palette: Palette
  onPick: (hex: string, color: Color) => void
  onSelect: (hex: string) => void
}) {
  return (
    <SelectionColorRows
      rows={selectionColors(sources, palette)}
      palette={palette}
      onPick={onPick}
      onSelect={onSelect}
    />
  )
}

export function SelectionColorRows({
  rows,
  palette,
  onPick,
  onSelect,
}: {
  rows: readonly { readonly hex: string; readonly color: Color }[]
  palette: Palette
  onPick: (hex: string, color: Color) => void
  onSelect: (hex: string) => void
}) {
  const id = useId()
  if (rows.length === 0) return null
  return (
    <DesignSection title={selectionColorsCopy.section}>
      <div className="flex flex-col gap-2" data-selection-colors>
        {rows.map(({ hex, color }) => (
          <div key={hex} className="grid grid-cols-[minmax(0,1fr)_max-content] items-center gap-1">
            <ColorPicker
              title={selectionColorsCopy.section}
              value={color}
              palette={palette}
              onPick={(picked) => onPick(hex, picked)}
              trigger={<Button type="button" variant="ghost" aria-labelledby={`${id}-${hex}`} className={fieldLook} />}
            >
              <ColorField
                id={`${id}-${hex}`}
                css={`#${hex}`}
                name={shownName(color, palette.templateColors)}
                disclosure={false}
              />
            </ColorPicker>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-[var(--control-dense)] shrink-0"
              aria-label={selectionColorsCopy.select(shownName(color, palette.templateColors))}
              title={selectionColorsCopy.select(shownName(color, palette.templateColors))}
              onClick={() => onSelect(hex)}
            >
              <Target />
            </Button>
          </div>
        ))}
      </div>
    </DesignSection>
  )
}
