import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "@/editor/pointer-tool"

export function useShortcutsKey(working: boolean, onToggle: () => void) {
  const latest = useRef(onToggle)
  useEffect(() => {
    latest.current = onToggle
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      if (gestureFor(event, "editor") !== "shortcuts" || !editorOwnsKey(event)) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
