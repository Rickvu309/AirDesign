import { type ExportRoute, type StructuralRoute } from "@airdesign/document"
import { type SlideRoute } from "./slide-route.js"

export const writtenRoutes = {
  text: "txBody",
  move: "xfrm",
  resize: "xfrm",
  add: "spTree.add",
  remove: "spTree.remove",
} as const satisfies Record<SlideRoute["name"], ExportRoute | StructuralRoute>
