import { blankOriginalName } from "./blank-export.mjs"
import { slideExportLines } from "./slide-export.mjs"

export const currentSlideOriginalName = "doe-heat-pumps.pptx"
export const currentSlideExportName = "exported-current-slide.pptx"
export const currentSlidePart = "ppt/slides/slide7.xml"
export const blankRangeOriginalName = blankOriginalName
export const blankRangeExportName = "exported-blank-range.pptx"

const structure = new Set(["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"])
const slideName = /^ppt\/slides\/slide\d+\.xml$/

function slideCount(parts) {
  return [...parts.keys()].filter((name) => slideName.test(name)).length
}

export function subsetLines({ pptx, parts, lists, ids, orders }, { label, original, exported, slides }) {
  const before = parts.get(original)
  const after = parts.get(exported)
  if (before === undefined || after === undefined) throw new Error(label)
  const kept = [...after.keys()].filter((name) => before.has(name) && !structure.has(name))
  const lines = slideExportLines({ pptx, parts, lists, ids, orders, kept, original, exported }).map((line) =>
    line.replace(/^slide export/, label),
  )
  if (slideCount(after) !== slides) lines.push(`${label} has ${slideCount(after)} slides, not ${slides}`)
  return lines
}

export function slideSubsetLines(judged) {
  return [
    ...subsetLines(judged, {
      label: "current slide export",
      original: currentSlideOriginalName,
      exported: currentSlideExportName,
      slides: 1,
    }),
    ...subsetLines(judged, {
      label: "blank range export",
      original: blankRangeOriginalName,
      exported: blankRangeExportName,
      slides: 2,
    }),
  ]
}
