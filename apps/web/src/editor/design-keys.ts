import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { changeDesign } from "@/design/design-change"
import { removeAutoLayout } from "@/editor/auto-layout-removal"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { selectedDesign, type DesigningDeck } from "@/editor/live-design-panel"
import { typing } from "@/editor/pointer-tool"

const alignOf: Partial<Readonly<Record<GestureId, string>>> = {
  "align-left": "left",
  "align-center": "center",
  "align-right": "right",
  "align-top": "top",
  "align-middle": "middle",
  "align-bottom": "bottom",
}

function alignControl(deck: DesigningDeck) {
  return selectedDesign(deck)?.controls.find((control) => control.trait === "box" && control.field === "align")
}

export function useDesignKeys(deck: DesigningDeck, working: boolean) {
  const latest = useRef(deck)
  useEffect(() => {
    latest.current = deck
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      const align = gesture === null ? undefined : alignOf[gesture]
      const now = latest.current
      if (align !== undefined) {
        if (alignControl(now) === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => alignControl(latest.current)?.change(align) ?? [])
        return
      }
      if (gesture !== "remove-auto-layout") return
      const [node, ...rest] = now.selection.ids
      if (node === undefined || rest.length > 0 || selectedDesign(now)?.model.frame !== "auto") return
      if (!editorOwnsKey(event)) return
      event.preventDefault()
      removeAutoLayout(now, node)
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
