import type { Design } from "./design.js"
import { lineGeometries, type Geometry } from "./element-order.js"

const drawnShape: Design = {
  fills: ["accent1", "style"],
  "border.width": [1, "style"],
  "border.fill": ["accent1 shade 15", "style"],
}

const drawnLine: Design = { "border.width": [2.3], "border.fill": ["accent1", "style"] }

const defaultRounding = 16_667
const emuPerPoint = 12_700

function roundedOf(geometry: Geometry, box: Size | undefined): Design {
  if (geometry !== "roundRect" || box === undefined) return {}
  const radius = Math.round((defaultRounding * Math.min(box.cx, box.cy)) / 100_000)
  return { "geometry.corners": [Math.round((radius / emuPerPoint) * 10) / 10] }
}

type Size = { readonly cx: number; readonly cy: number }

const drawnText: Design = {
  "text.color": ["lt1", "style"],
  "text.font": ["+mn-lt", "style"],
  "body.anchor": ["ctr"],
}

export function drawnDesign(geometry: Geometry, box?: Size, holdsText = false): Design {
  const named: Design = geometry === "rect" ? {} : { geometry: [geometry], ...roundedOf(geometry, box) }
  if (geometry === "straightConnector1") return { ...named, ...drawnLine, "border.tail": ["triangle"] }
  if (lineGeometries.includes(geometry)) return { ...named, ...drawnLine }
  return { ...named, ...drawnShape, ...(holdsText ? drawnText : {}) }
}
