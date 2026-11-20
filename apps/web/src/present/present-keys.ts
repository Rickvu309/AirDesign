import { gestureFor } from "@airdesign/render"
import { useEffect, useRef } from "react"

export type PresentFrom = "first" | "current"

function field(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

export function presentKey(event: {
  readonly key: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly field: boolean
}): PresentFrom | null {
  const gesture = gestureFor(event, "editor")
  if (gesture === "present") return "first"
  if (gesture !== "present-here") return null
  return event.field && !event.shiftKey ? null : "current"
}

export function usePresentKeys(working: boolean, onKey: (from: PresentFrom) => void) {
  const latest = useRef(onKey)
  useEffect(() => {
    latest.current = onKey
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      const from = presentKey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        field: field(event.target),
      })
      if (from === null) return
      event.preventDefault()
      latest.current(from)
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
