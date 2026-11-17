import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"

export type UndoKey = "undo" | "redo"

function field(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || target.closest("[data-person-undo]") !== null) return false
  return target.closest("input, textarea, select") !== null
}

export function undoKey(event: {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly field: boolean
}): UndoKey | null {
  if (event.field) return null
  const gesture = gestureFor(event, "editor")
  return gesture === "undo" || gesture === "redo" ? gesture : null
}

export function useUndoKeys(working: boolean, onKey: (key: UndoKey) => void) {
  const latest = useRef(onKey)
  useEffect(() => {
    latest.current = onKey
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (!editorOwnsKey(event)) return
      const key = undoKey({
        key: event.key,
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
