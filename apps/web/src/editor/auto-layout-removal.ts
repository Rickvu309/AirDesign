import { changeLayout, type ElementId } from "@airdesign/document"
import { changeRows, type DesignDeck } from "@/design/design-change"

export function removeAutoLayout(deck: DesignDeck, node: ElementId) {
  changeRows(
    deck,
    (register) => {
      const changed = changeLayout(register, { remove: node })
      return changed === null || !("rows" in changed) ? null : changed.rows
    },
    "remove-auto-layout",
  )
}
