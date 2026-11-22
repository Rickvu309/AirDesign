import { scene } from "@airdesign/document"
import type { Palette } from "@/design/color-choices"
import { SelectionColorRows } from "@/editor/selection-colors-section"
import { colorRows, idsWithColor, replaceColorWrites } from "./design-selection-colors"
import { sceneColorOf } from "./design-values"
import type { Selection } from "./selection"
import type { EditorClient } from "./use-scene-deck"

export function SceneSelectionColors(props: {
  readonly client: EditorClient
  readonly view: scene.Scene
  readonly slide: scene.NodeId
  readonly ids: readonly scene.NodeId[]
  readonly palette: Palette
  readonly onSelection: (selection: Selection) => void
}) {
  const { client, view, slide, ids, palette, onSelection } = props
  const theme = scene.deckOf(view).theme
  const scope = { slide, ids }
  return (
    <SelectionColorRows
      rows={colorRows(view, theme, scope)}
      palette={palette}
      onPick={(hex, color) => {
        const next = sceneColorOf(color)
        if (next === undefined) return
        const writes = replaceColorWrites(view, theme, scope, hex, next)
        if (writes.length > 0) client.push(writes)
      }}
      onSelect={(hex) => {
        const found = idsWithColor(view, theme, { slide, ids: [] }, hex)
        if (found.length > 0) onSelection({ ids: found, inside: null })
      }}
    />
  )
}
