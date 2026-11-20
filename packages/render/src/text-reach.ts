import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type RefObject } from "react"
import { releases } from "./gestures.js"
import { keepsFormat } from "./text-formatting.js"

export type CaretKeeping<Carets> = {
  readonly read: (box: HTMLElement) => Carets | null
  readonly place: (box: HTMLElement, carets: Carets) => void
}

function letGoOfSelection(box: HTMLElement, next: EventTarget | null): void {
  const document = box.ownerDocument
  if (document.activeElement === box) return
  if (next instanceof Element && next.closest(keepsFormat) !== null) return
  const selection = document.getSelection()
  if (selection === null || selection.rangeCount === 0 || !box.contains(selection.anchorNode)) return
  selection.removeAllRanges()
}

export function useTextReach<Carets>(box: RefObject<HTMLElement | null>, carets: CaretKeeping<Carets>) {
  const reached = useRef<"tab" | "pointer" | "editing" | null>(null)
  const leftAt = useRef<Carets | null>(null)
  const keeping = useRef(carets)
  useLayoutEffect(() => {
    keeping.current = carets
  })
  useLayoutEffect(() => {
    const shown = box.current
    if (shown === null) return
    const document = shown.ownerDocument
    const track = () => {
      if (document.activeElement !== shown) return
      const now = keeping.current.read(shown)
      if (now !== null) leftAt.current = now
    }
    document.addEventListener("selectionchange", track)
    return () => document.removeEventListener("selectionchange", track)
  }, [box])
  return {
    passesTab(): boolean {
      if (reached.current === "tab") return true
      reached.current = "editing"
      return false
    },
    typed() {
      reached.current = "editing"
    },
    handlers: {
      onFocus(event: FocusEvent<HTMLElement>) {
        const from = event.relatedTarget
        const kept = leftAt.current
        const back = from instanceof Element && from.closest(keepsFormat) !== null
        if (reached.current !== "pointer" && kept !== null && back) keeping.current.place(event.currentTarget, kept)
        reached.current = reached.current === "pointer" ? "editing" : null
      },
      onBlur(event: FocusEvent<HTMLElement>) {
        reached.current = null
        letGoOfSelection(event.currentTarget, event.relatedTarget)
      },
      onPointerDown() {
        reached.current = "pointer"
      },
      onKeyUp(event: KeyboardEvent<HTMLElement>) {
        if (reached.current === null && (releases(event, "list-indent") || releases(event, "list-outdent")))
          reached.current = "tab"
      },
    },
  }
}
