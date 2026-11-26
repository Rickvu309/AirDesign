import { gestureFor } from "@/lib/gestures"
import { useEffect } from "react"
import { editorOwnsKey } from "@/editor/editor-key-ownership"
import { typing } from "./use-canvas-keys"
import type { EditorClient } from "./use-deck"

export function useGridHistoryKeys(grid: boolean, client: EditorClient) {
  useEffect(() => {
    if (!grid) return
    function down(event: KeyboardEvent) {
      if (event.isComposing || typing(event.target)) return
      const gesture = gestureFor(event, "editor")
      if (gesture !== "undo" && gesture !== "redo") return
      if (!editorOwnsKey(event)) return
      event.preventDefault()
      if (gesture === "undo") client.undo()
      else client.redo()
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [grid, client])
}
