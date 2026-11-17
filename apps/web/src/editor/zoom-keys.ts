import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { useEffect, useRef } from "react"
import { zoomKey, type ZoomKey } from "@/editor/canvas-zoom"

function field(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

export function useZoomKeys(working: boolean, onKey: (key: ZoomKey) => void) {
  const latest = useRef(onKey)
  useEffect(() => {
    latest.current = onKey
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (!editorOwnsKey(event)) return
      const key = zoomKey({
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        field: field(event.target),
      })
      if (key === null) return
      event.preventDefault()
      latest.current(key)
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
