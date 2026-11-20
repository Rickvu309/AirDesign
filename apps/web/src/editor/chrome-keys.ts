import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "@/editor/pointer-tool"

export type ChromeKeyActions = {
  readonly onHideAll: () => void
  readonly onSlideList: () => void
  readonly onRulers: () => void
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
      if ((gesture !== "hide-ui" && gesture !== "slide-list" && gesture !== "rulers") || !editorOwnsKey(event)) return
      event.preventDefault()
      if (gesture === "hide-ui") latest.current.onHideAll()
      else if (gesture === "rulers") latest.current.onRulers()
      else latest.current.onSlideList()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
