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
  if (event.altKey) return null
  if (event.key === "F5" && !event.metaKey && !event.ctrlKey) return event.shiftKey ? "current" : "first"
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.field) return "current"
  return null
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
