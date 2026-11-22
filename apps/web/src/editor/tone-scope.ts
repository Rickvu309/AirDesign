import { openRegister, type ElementId } from "@airdesign/document"
import { textValue } from "@airdesign/render"
import type { ToneScope } from "@/aira/aira-prompts"
import { deviceScope } from "@/design/trait-edit"
import type { DeckPaint } from "@/editor/use-deck-paint"

export function toneScope(shown: DeckPaint, selection: readonly ElementId[]): ToneScope | null {
  const store = shown.store.current
  const slide = store.slides()[shown.current]
  if (slide === undefined) return null

  const picked = new Set(selection)
  const scope =
    picked.size === 0
      ? null
      : deviceScope(shown.shownParts.current, shown.shownRegister.current ?? openRegister("", ""))

  function includes(node: ElementId): boolean {
    if (scope === null) return true
    let parent: ElementId | null | undefined = node
    while (parent != null) {
      if (picked.has(parent)) return true
      parent = scope.view(parent)?.parent
    }
    return false
  }

  const text = slide.elements.filter((node) => {
    const element = store.getElement(node)
    return (
      element?.kind === "shape" &&
      includes(node) &&
      textValue(element.text).some(({ runs }) => runs.some((run) => run.text.trim() !== ""))
    )
  })
  return { slide: slide.id, selection, text }
}
