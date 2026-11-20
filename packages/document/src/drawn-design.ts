import type { Design } from "./design.js"
import { lineGeometries, type Geometry } from "./element-order.js"

const drawnShape: Design = {
  fills: ["accent1", "style"],
  "border.width": [1, "style"],
  "border.fill": ["accent1 shade 15", "style"],
}

const drawnLine: Design = { "border.width": [2.3], "border.fill": ["accent1", "style"] }

export function drawnDesign(geometry: Geometry): Design {
  const named: Design = geometry === "rect" ? {} : { geometry: [geometry] }
  if (geometry === "straightConnector1") return { ...named, ...drawnLine, "border.tail": ["triangle"] }
  return { ...named, ...(lineGeometries.includes(geometry) ? drawnLine : drawnShape) }
}
