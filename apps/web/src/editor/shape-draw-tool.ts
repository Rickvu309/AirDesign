import { lineGeometries, type Geometry } from "@airdesign/document"
import { type ShapeDrawing, type ShapeDrawn, type ShapeLook } from "@airdesign/render"
import { type ToolPick } from "@/editor/pointer-tool"

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
