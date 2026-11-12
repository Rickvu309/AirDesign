import { slideExportLines } from "./slide-export.mjs"

export const chartEditsExportName = "exported-chart-edits.pptx"
export const chartEditsOriginalName = "census-updating-spm.pptx"

const slidePart = "ppt/slides/slide19.xml"
const changedParts = new Set([
  "[Content_Types].xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  slidePart,
])
const slideName = /^ppt\/slides\/slide\d+\.xml$/
const chartUri = "http://schemas.openxmlformats.org/drawingml/2006/chart"

export function chartFrames(bytes) {
  const xml = new TextDecoder().decode(bytes)
  const frames = []
  let at = xml.indexOf("<p:graphicFrame>")
  while (at >= 0) {
    const end = xml.indexOf("</p:graphicFrame>", at) + "</p:graphicFrame>".length
    const frame = xml.slice(at, end)
    if (frame.includes(chartUri)) frames.push(frame)
    at = xml.indexOf("<p:graphicFrame>", end)
  }
  return frames
}

export function chartEditsLines({ pptx, parts, lists, ids, orders }) {
  const before = parts.get(chartEditsOriginalName)
  const after = parts.get(chartEditsExportName)
  if (before === undefined || after === undefined) throw new Error("chart edits export")
  const lines = slideExportLines({
    pptx,
    parts,
    lists,
    ids,
    orders,
    kept: [...before.keys()].filter((name) => !changedParts.has(name)),
    original: chartEditsOriginalName,
    exported: chartEditsExportName,
  }).map((line) => line.replace(/^slide export/, "chart edits"))
  const frames = chartFrames(before.get(slidePart)).join("")
  const copies = [...after.keys()].filter((name) => slideName.test(name) && !before.has(name))
  if (copies.length !== 1) lines.push(`chart edits ${copies.length} added slides`)
  if (frames === "") lines.push("chart edits no chart frame in the original")
  for (const name of [slidePart, ...copies]) {
    if (chartFrames(after.get(name)).join("") !== frames) lines.push(`chart edits frames changed in ${name}`)
  }
  return lines
}
