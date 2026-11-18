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
}: {
  sources: readonly ColorSource[]
  palette: Palette
  onPick: (hex: string, color: Color) => void
}) {
  const id = useId()
  const rows = selectionColors(sources, palette)
  if (rows.length === 0) return null
  return (
    <DesignSection title={selectionColorsCopy.section}>
      <div className="flex w-3/4 flex-col gap-2" data-selection-colors>
        {rows.map(({ hex, color }) => (
          <ColorPicker
            key={hex}
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
        ))}
      </div>
    </DesignSection>
  )
}
