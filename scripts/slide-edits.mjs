import { slideExportLines } from "./slide-export.mjs"

export const slideEditsExportName = "exported-slide-edits.pptx"
export const slideEditsOriginalName = "blank.pptx"

const titleBox = { x: 914400, y: 1828800, cx: 10363200, cy: 1371600 }
const emuPerPixel = 15_240
const copyBox = {
  x: titleBox.x + 12_700,
  y: titleBox.y,
  cx: titleBox.cx - 120 * emuPerPixel,
  cy: titleBox.cy + 60 * emuPerPixel,
}
const changedParts = new Set([
  "[Content_Types].xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "ppt/slides/slide1.xml",
])

function words(shape) {
  return shape.text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

function found(parts, pptx, slide, shape) {
  return pptx.readShapes(parts).find((row) => row.slide === slide && row.shape === shape)
}

export function slideEditsLines({ pptx, parts, lists, ids, orders }) {
  const before = parts.get(slideEditsOriginalName)
  const after = parts.get(slideEditsExportName)
  if (before === undefined || after === undefined) throw new Error("slide edits export")
  const lines = slideExportLines({
    pptx,
    parts,
    lists,
    ids,
    orders,
    kept: [...before.keys()].filter((name) => !changedParts.has(name)),
    original: slideEditsOriginalName,
    exported: slideEditsExportName,
  })
  const expectShape = (slide, shape, text, box) => {
    const row = found(after, pptx, slide, shape)
    if (row === undefined) {
      lines.push(`slide edits missing ${slide}.${shape}`)
      return
    }
    const written = words(row)
    if (written !== text) lines.push(`slide edits ${slide}.${shape} text ${written}`)
    if (box !== undefined && JSON.stringify(row.box) !== JSON.stringify(box)) {
      lines.push(`slide edits ${slide}.${shape} box ${JSON.stringify(row.box)}`)
    }
  }
  expectShape("256", "2", "Source after", titleBox)
  expectShape("257", "2", "Copy title", copyBox)
  expectShape("258", "2", "Typed on a new slide")
  return lines
}
