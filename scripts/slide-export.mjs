import { judge } from "./judge.mjs"

export const slideOriginalName = "tall-glyph-before.pptx"
export const slideExportName = "exported-slides.pptx"
export const slideKeptParts = ["ppt/slides/slide1.xml"]

export const slideExportLines = ({
  pptx,
  parts,
  lists,
  ids,
  orders,
  original = slideOriginalName,
  exported = slideExportName,
  kept = slideKeptParts,
}) => {
  const before = parts.get(original)
  const after = parts.get(exported)
  if (before === undefined || after === undefined) throw new Error("slide export")
  const lines = pptx.slideExportFailures(before, after, kept).map((failure) => `slide export ${failure}`)
  const verdict = judge(
    pptx,
    {
      list: lists.get(original),
      ids: ids.get(original),
      orders: orders.get(original),
    },
    {
      list: lists.get(exported),
      ids: ids.get(exported),
      orders: orders.get(exported),
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
