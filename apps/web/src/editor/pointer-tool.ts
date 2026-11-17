import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { gestureFor } from "@airdesign/render"
import { useEffect, useState } from "react"

export type PointerTool = "move" | "hand"

export type ToolPick = { readonly tool: PointerTool; readonly pick: (tool: PointerTool) => void }

export function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

function toolForKey(event: KeyboardEvent): PointerTool | null {
  if (typing(event.target)) return null
  const gesture = gestureFor(event, "editor")
  if (gesture === "tool-move") return "move"
  return gesture === "tool-hand" ? "hand" : null
}

export function usePointerTool(working: boolean): ToolPick {
  const [tool, pick] = useState<PointerTool>("move")
  useEffect(() => {
    if (!working) return
    function onKey(event: KeyboardEvent) {
      if (!editorOwnsKey(event)) return
      const next = toolForKey(event)
      if (next !== null) pick(next)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [working])
  return { tool, pick }
}
