import { opaque } from "@airdesign/document"
import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { changeDesign } from "@/design/design-change"
import { removeAutoLayout } from "@/editor/auto-layout-removal"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { selectedDesign, type DesigningDeck } from "@/editor/live-design-panel"
import { onLayers, typing } from "@/editor/pointer-tool"

const alignOf: Partial<Readonly<Record<GestureId, string>>> = {
  "align-left": "left",
  "align-center": "center",
  "align-right": "right",
  "align-top": "top",
  "align-middle": "middle",
  "align-bottom": "bottom",
}

const pairWithin = 500

function controlOf(deck: DesigningDeck, trait: string, field: string) {
  return selectedDesign(deck)?.controls.find((control) => control.trait === trait && control.field === field)
}

function opacityTyped(digit: string, pair: string | null): number {
  const percent = pair === null ? (digit === "0" ? 100 : Number(digit) * 10) : Number(pair)
  return (percent * opaque) / 100
}

export function useDesignKeys(deck: DesigningDeck, working: boolean) {
  const latest = useRef(deck)
  const typed = useRef<{ readonly digit: string; readonly at: number } | null>(null)
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
        if (controlOf(now, "box", "align") === undefined || !editorOwnsKey(event)) return
        event.preventDefault()
        changeDesign(now, () => controlOf(latest.current, "box", "align")?.change(align) ?? [])
        return
      }
      if (gestureFor(event, "element") === "opacity") {
        if (!onLayers(event.target) || controlOf(now, "opacity", "opacity") === undefined) return
        if (!editorOwnsKey(event)) return
        event.preventDefault()
        const last = typed.current
        const pair = last !== null && event.timeStamp - last.at < pairWithin ? last.digit + event.key : null
        typed.current = pair === null ? { digit: event.key, at: event.timeStamp } : null
        const value = opacityTyped(event.key, pair)
        changeDesign(now, () => controlOf(latest.current, "opacity", "opacity")?.change(value) ?? [])
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
