import type { ElementId } from "@airdesign/document"
import type { FocusEvent, KeyboardEvent } from "react"
import type { Moves } from "./moves.js"
import type { CanvasElement } from "./record.js"
import { keepsFormat, runTextKey, textKeyOf, type TextFormatting } from "./text-formatting.js"

export function formatReach(
  formatting: TextFormatting | undefined,
  id: ElementId,
  moves: Moves | null,
  element: CanvasElement,
  wordless: boolean,
) {
  if (formatting === undefined) return {}
  return {
    onFocus: (event: FocusEvent<HTMLElement>) => {
      moves?.select(id)
      const aimed = event.target instanceof HTMLElement && !(wordless && event.target === event.currentTarget)
      if (aimed && event.target instanceof HTMLElement) formatting.aim(id, event.target)
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget
      if (next instanceof Element && (event.currentTarget.contains(next) || next.closest(keepsFormat) !== null)) return
      formatting.aim(null)
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const text = textKeyOf(event)
      if (text === null) {
        moves?.key(event, element)
        return
      }
      event.preventDefault()
      const onFrame = event.target === event.currentTarget
      runTextKey(formatting, text, onFrame && moves !== null ? moves.latest.current.ids : [])
    },
  }
}
