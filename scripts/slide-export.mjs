import { judge } from "./judge.mjs"

export const slideOriginalName = "tall-glyph-before.pptx"
export const slideExportName = "exported-slides.pptx"
export const slideKeptParts = ["ppt/slides/slide1.xml"]

export const slideExportLines = ({ pptx, parts, lists, ids, orders }) => {
  const before = parts.get(slideOriginalName)
  const after = parts.get(slideExportName)
  if (before === undefined || after === undefined) throw new Error("slide export")
  const lines = pptx.slideExportFailures(before, after, slideKeptParts).map((failure) => `slide export ${failure}`)
  const verdict = judge(
    pptx,
    {
      list: lists.get(slideOriginalName),
      ids: ids.get(slideOriginalName),
      orders: orders.get(slideOriginalName),
    },
    {
      list: lists.get(slideExportName),
      ids: ids.get(slideExportName),
      orders: orders.get(slideExportName),
      dangling: pptx.newDanglingShapeReferences(
        pptx.danglingShapeReferences(before),
        pptx.danglingShapeReferences(after),
      ),
    },
  )
  for (const error of verdict.errors) lines.push(`slide export validator ${error}`)
  for (const dupe of verdict.dupes) lines.push(`slide export duplicate shape id ${JSON.stringify(dupe)}`)
  for (const item of verdict.dangling) lines.push(`slide export dangling ${item.kind} ${item.id}`)
  return lines
}
