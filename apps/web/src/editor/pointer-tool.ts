import type { Geometry } from "@airdesign/document"
import { editorOwnsKey, toolKeyPlace } from "@/editor/editor-key-ownership"
import { gestureFor } from "@airdesign/render"
import { useCallback, useEffect, useMemo, useState } from "react"

export type PointerTool = "move" | "hand" | "text"

export type ToolPick = {
  readonly tool: PointerTool
  readonly pick: (tool: PointerTool) => void
  readonly shape: Geometry | null
  readonly arm: (shape: Geometry) => void
}

export function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

function toolForKey(event: KeyboardEvent, placesText: boolean): PointerTool | null {
  if (typing(event.target)) return null
  const place = toolKeyPlace(event.target)
  if (place !== null && gestureFor(event, place) === "tool-text") return placesText ? "text" : null
  const gesture = gestureFor(event, "editor")
  if (gesture === "tool-move") return "move"
  return gesture === "tool-hand" ? "hand" : null
}

export function usePointerTool(working: boolean, placesText: boolean): ToolPick {
  const [tool, choose] = useState<PointerTool>("move")
  const [shape, setShape] = useState<Geometry | null>(null)
  if (!placesText && tool === "text") choose("move")
  if (!placesText && shape !== null) setShape(null)
  useEffect(() => {
    if (!working) return
    function onKey(event: KeyboardEvent) {
      if (gestureFor(event, "element") === "deselect") {
        choose((now) => (now === "text" ? "move" : now))
        setShape(null)
      }
      if (!editorOwnsKey(event)) return
      const next = toolForKey(event, placesText)
      if (next === null) return
      choose(next)
      setShape(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [working, placesText])
  const pick = useCallback((next: PointerTool) => {
    choose(next)
    setShape(null)
  }, [])
  const arm = useCallback((next: Geometry) => {
    choose("move")
    setShape(next)
  }, [])
  return useMemo(() => ({ tool, shape, pick, arm }), [tool, shape, pick, arm])
}
