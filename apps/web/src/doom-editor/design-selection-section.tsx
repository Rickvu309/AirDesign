import * as doom from "@airdesign/doom"
import type { Palette } from "@/design/color-choices"
import { SelectionColorRows } from "@/editor/selection-colors-section"
import { colorRows, idsWithColor, replaceColorWrites } from "./design-selection-colors"
import type { Selection } from "./selection"
import type { EditorClient } from "./use-doom-deck"

export function DoomSelectionColors(props: {
  readonly client: EditorClient
  readonly view: doom.Doom
  readonly slide: doom.NodeId
  readonly ids: readonly doom.NodeId[]
  readonly palette: Palette
  readonly onSelection: (selection: Selection) => void
}) {
  const { client, view, slide, ids, palette, onSelection } = props
  const theme = doom.deckOf(view).theme
  const scope = { slide, ids }
  return (
    <SelectionColorRows
      rows={colorRows(view, theme, scope)}
      palette={palette}
      onPick={(hex, color) => {
        const writes = replaceColorWrites(view, theme, scope, hex, color)
        if (writes.length > 0) client.push(writes)
      }}
      onSelect={(hex) => {
        const found = idsWithColor(view, theme, { slide, ids: [] }, hex)
        if (found.length > 0) onSelection({ ids: found, inside: null })
      }}
    />
  )
}
