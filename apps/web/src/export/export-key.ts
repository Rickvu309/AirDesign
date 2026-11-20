import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"

export function useExportKey(onOpen: () => void) {
  const latest = useRef(onOpen)
  useEffect(() => {
    latest.current = onOpen
  })
  useEffect(() => {
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented) return
      if (gestureFor(event, "editor") !== "export" || !editorOwnsKey(event)) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [])
}
