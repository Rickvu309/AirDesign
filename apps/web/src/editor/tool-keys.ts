import type { Geometry } from "@airdesign/document"
import { gestureFor, type GestureId } from "@airdesign/render"
import { useEffect, useRef } from "react"
import { editorOwnsKey, toolKeyPlace } from "@/editor/editor-key-ownership"
import { pickPicture } from "@/editor/picture-picker"
import { typing } from "@/editor/pointer-tool"

export type ToolKeyActions = {
  readonly onTablePicker: (() => void) | undefined
  readonly onShape: ((geometry: Geometry) => void) | undefined
  readonly onPicture: ((file: File) => void) | undefined
}

const shapeOfGesture: Partial<Readonly<Record<GestureId, Geometry>>> = {
  "tool-rectangle": "rect",
  "tool-ellipse": "ellipse",
  "tool-line": "line",
  "tool-arrow": "straightConnector1",
}

function toolRun(gesture: GestureId | null, actions: ToolKeyActions): (() => void) | undefined {
  const { onTablePicker, onShape, onPicture } = actions
  const shape = gesture === null ? undefined : shapeOfGesture[gesture]
  if (gesture === "tool-table") return onTablePicker
  if (shape !== undefined && onShape !== undefined) return () => onShape(shape)
  if (gesture === "place-image" && onPicture !== undefined) return () => pickPicture(onPicture)
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
