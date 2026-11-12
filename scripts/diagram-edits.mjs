import { slideExportLines } from "./slide-export.mjs"

export const diagramEditsExportName = "exported-diagram-edits.pptx"
export const diagramEditsOriginalName = "census-updating-spm.pptx"

const slidePart = "ppt/slides/slide5.xml"
const changedParts = new Set([
  "[Content_Types].xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  slidePart,
])
const slideName = /^ppt\/slides\/slide\d+\.xml$/

export function diagramFrame(bytes) {
  const xml = new TextDecoder().decode(bytes)
  const start = xml.lastIndexOf("<p:graphicFrame>", xml.indexOf("dgm:relIds"))
  const end = xml.indexOf("</p:graphicFrame>", start)
  return start < 0 || end < 0 ? null : xml.slice(start, end + "</p:graphicFrame>".length)
}

export function diagramEditsLines({ pptx, parts, lists, ids, orders }) {
  const before = parts.get(diagramEditsOriginalName)
  const after = parts.get(diagramEditsExportName)
  if (before === undefined || after === undefined) throw new Error("diagram edits export")
  const lines = slideExportLines({
    pptx,
    parts,
    lists,
    ids,
    orders,
    kept: [...before.keys()].filter((name) => !changedParts.has(name)),
    original: diagramEditsOriginalName,
    exported: diagramEditsExportName,
  }).map((line) => line.replace(/^slide export/, "diagram edits"))
  const frame = diagramFrame(before.get(slidePart))
  const copies = [...after.keys()].filter((name) => slideName.test(name) && !before.has(name))
  if (copies.length !== 1) lines.push(`diagram edits ${copies.length} added slides`)
  for (const name of [slidePart, ...copies]) {
    if (frame === null || diagramFrame(after.get(name)) !== frame) lines.push(`diagram edits frame changed in ${name}`)
  }
  return lines
}
