import { slideExportLines } from "./slide-export.mjs"

export const shapeExportName = "exported-shapes.pptx"
export const shapeOriginalName = "blank.pptx"
export const shapeSlidePart = "ppt/slides/slide1.xml"
export const shapeKinds = [
  ["4", "p:sp", "rect"],
  ["5", "p:sp", "ellipse"],
  ["6", "p:cxnSp", "line"],
]

export function shapeExportLines({ pptx, parts, lists, ids, orders }) {
  const before = parts.get(shapeOriginalName)
  const after = parts.get(shapeExportName)
  if (before === undefined || after === undefined) throw new Error("shape export")
  const lines = slideExportLines({
    pptx,
    parts,
    lists,
    ids,
    orders,
    original: shapeOriginalName,
    exported: shapeExportName,
    kept: [...before.keys()].filter((name) => name !== shapeSlidePart),
  }).map((line) => line.replace(/^slide export/, "shape export"))
  const painted = pptx.paintReader(after).slide(shapeSlidePart).elements
  const shapes = pptx.readShapes(after)
  for (const [shape, kind, geometry] of shapeKinds) {
    const row = shapes.find((each) => each.part === shapeSlidePart && each.shape === shape)
    const paint = painted.find((each) => each.shape === shape)
    if (row?.kind !== kind || paint?.geometry !== geometry)
      lines.push(`shape export ${shape} is ${row?.kind ?? "missing"} ${paint?.geometry ?? ""}, not ${kind} ${geometry}`)
  }
  return lines
}
