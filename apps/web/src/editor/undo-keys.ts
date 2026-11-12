import { useEffect, useRef } from "react"
import { typing } from "@/editor/pointer-tool"

export type UndoKey = "undo" | "redo"

export function undoKey(event: {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly typing: boolean
}): UndoKey | null {
  if (event.typing || event.altKey || !(event.metaKey || event.ctrlKey)) return null
  const key = event.key.toLowerCase()
  if (key === "z") return event.shiftKey ? "redo" : "undo"
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) return "redo"
  return null
}

export function useUndoKeys(working: boolean, onKey: (key: UndoKey) => void) {
  const latest = useRef(onKey)
  useEffect(() => {
    latest.current = onKey
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      const key = undoKey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        typing: typing(event.target),
      })
      if (key === null) return
      event.preventDefault()
      latest.current(key)
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
