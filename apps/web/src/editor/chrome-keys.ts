import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "@/editor/pointer-tool"

const chromeGestures: ReadonlySet<GestureId> = new Set(["hide-ui", "slide-list", "rulers", "layout-guides"])

export type ChromeKeyActions = {
  readonly onHideAll: () => void
  readonly onSlideList: () => void
  readonly onRulers: () => void
  readonly onLayoutGuides: () => void
}

export function useChromeKeys(working: boolean, actions: ChromeKeyActions) {
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if (gesture === null || !chromeGestures.has(gesture) || !editorOwnsKey(event)) return
      event.preventDefault()
      if (gesture === "hide-ui") latest.current.onHideAll()
      else if (gesture === "rulers") latest.current.onRulers()
      else if (gesture === "layout-guides") latest.current.onLayoutGuides()
      else latest.current.onSlideList()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
