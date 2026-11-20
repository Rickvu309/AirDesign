import { editorOwnsKey, toolKeyPlace } from "@/editor/editor-key-ownership"
import { gestureFor } from "@airdesign/render"
import { useEffect, useState } from "react"

export type PointerTool = "move" | "hand" | "text"

export type ToolPick = { readonly tool: PointerTool; readonly pick: (tool: PointerTool) => void }

export function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

export function onLayers(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-slide-paint], [data-layers-panel]") !== null
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
  const [tool, pick] = useState<PointerTool>("move")
  if (!placesText && tool === "text") pick("move")
  useEffect(() => {
    if (!working) return
    function onKey(event: KeyboardEvent) {
      if (gestureFor(event, "element") === "deselect") pick((now) => (now === "text" ? "move" : now))
      if (!editorOwnsKey(event)) return
      const next = toolForKey(event, placesText)
      if (next !== null) pick(next)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [working, placesText])
  return { tool, pick }
}
