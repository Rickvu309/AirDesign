import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "@/editor/pointer-tool"

export function useHideKeys(working: boolean, onHide: () => void) {
  const latest = useRef(onHide)
  useEffect(() => {
    latest.current = onHide
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      if (gestureFor(event, "editor") !== "hide" || !editorOwnsKey(event)) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
