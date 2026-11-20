import { lineGeometries, type Geometry } from "@airdesign/document"
import { gestureFor, type ShapeDrawing, type ShapeDrawn, type ShapeLook } from "@airdesign/render"
import { useEffect } from "react"
import { typing, type ToolPick } from "@/editor/pointer-tool"

export type ShapeAdd = (geometry: Geometry, drawn?: ShapeDrawn) => void

export function shapeLook(geometry: Geometry): ShapeLook {
  if (lineGeometries.includes(geometry)) return "line"
  return geometry === "ellipse" ? "ellipse" : "box"
}

export function shapeDrawing(pointer: ToolPick, onShape: ShapeAdd | undefined): ShapeDrawing | undefined {
  const armed = pointer.shape
  if (armed === null || onShape === undefined) return undefined
  return {
    look: shapeLook(armed),
    onDraw: (drawn) => {
      pointer.pick("move")
      onShape(armed, drawn)
    },
  }
}

export function useArmedShapeEnter(pointer: ToolPick, onShape: ShapeAdd | undefined) {
  const armed = pointer.shape
  const { pick } = pointer
  useEffect(() => {
    if (armed === null || onShape === undefined) return
    const shape = armed
    function placed(event: KeyboardEvent) {
      if (gestureFor(event, "armed") !== "place-shape" || event.isComposing || typing(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      pick("move")
      onShape?.(shape)
    }
    window.addEventListener("keydown", placed, true)
    return () => window.removeEventListener("keydown", placed, true)
  }, [armed, onShape, pick])
}
