import type { Geometry } from "@airdesign/document"
import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey, toolKeyPlace } from "@/editor/editor-key-ownership"
import { typing } from "@/editor/pointer-tool"

export type ToolKeyActions = {
  readonly onShape: ((geometry: Geometry) => void) | undefined
}

const shapeOfGesture: Partial<Readonly<Record<GestureId, Geometry>>> = {
  "tool-rectangle": "rect",
  "tool-ellipse": "ellipse",
  "tool-line": "line",
  "tool-arrow": "straightConnector1",
}

function toolRun(gesture: GestureId | null, actions: ToolKeyActions): (() => void) | undefined {
  const { onShape } = actions
  const shape = gesture === null ? undefined : shapeOfGesture[gesture]
  if (shape !== undefined && onShape !== undefined) return () => onShape(shape)
  return undefined
}

export function useToolKeys(working: boolean, actions: ToolKeyActions) {
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })
  useEffect(() => {
    if (!working) return
    function listen(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.defaultPrevented || typing(event.target)) return
      const place = toolKeyPlace(event.target)
      if (place === null) return
      const run = toolRun(gestureFor(event, place), latest.current)
      if (run === undefined || !editorOwnsKey(event)) return
      event.preventDefault()
      run()
    }
    window.addEventListener("keydown", listen)
    return () => window.removeEventListener("keydown", listen)
  }, [working])
}
