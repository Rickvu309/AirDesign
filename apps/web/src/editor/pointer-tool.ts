import { useEffect, useState } from "react"

export type PointerTool = "move" | "hand"

export type ToolPick = { readonly tool: PointerTool; readonly pick: (tool: PointerTool) => void }

const toolKeys: Readonly<Record<string, PointerTool>> = { v: "move", h: "hand" }

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select") !== null
}

function toolForKey(event: KeyboardEvent): PointerTool | null {
  if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return null
  return toolKeys[event.key.toLowerCase()] ?? null
}

export function usePointerTool(working: boolean): ToolPick {
  const [tool, pick] = useState<PointerTool>("move")
  useEffect(() => {
    if (!working) return
    function onKey(event: KeyboardEvent) {
      const next = toolForKey(event)
      if (next !== null) pick(next)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [working])
  return { tool, pick }
}
