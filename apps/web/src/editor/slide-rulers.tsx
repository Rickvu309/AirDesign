import { CanvasRulers } from "@airdesign/render"
import type { ReactNode } from "react"
import type { EditableDeck } from "@/editor/editable-slide"
import { changeGuides, guidedCanvas } from "@/editor/slide-guides"

export function slideRulers(deck: EditableDeck): () => ReactNode {
  return function rulers() {
    const { canvases, current, store, displayParts } = deck.shown
    const canvas = canvases.current(current)
    if (canvas === null) return null
    return (
      <CanvasRulers
        slide={guidedCanvas(canvas, displayParts.current, current, { rulers: true, layoutGuides: false })}
        store={store.current}
        selected={deck.selection.ids}
        onGuides={(edit) => changeGuides(deck, current, edit)}
      />
    )
  }
}
