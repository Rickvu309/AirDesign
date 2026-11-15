import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const exported = "exported-new-slide-prompts.pptx"
const changedParts = new Set([
  "[Content_Types].xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "docProps/app.xml",
])

const newSlideLines = (parts) => {
  const before = new Set(parts.get(original).keys())
  const added = [...parts.get(exported)].filter(
    ([name]) => !before.has(name) && /^ppt\/slides\/slide\d+\.xml$/.test(name),
  )
  if (added.length !== 1) return [`new slide parts ${added.length}`]
  const xml = new TextDecoder().decode(added[0][1])
  const lines = []
  if (/type="(dt|ftr|sldNum)"/.test(xml)) lines.push("new slide carries footer boxes the deck does not show")
  if (/lvl="[1-8]"/.test(xml)) lines.push("new slide has a paragraph below the first level")
  if (xml.includes("Click to")) lines.push("new slide writes a prompt as text")
  return lines
}

export default {
  specs: ["tests/browser/new-slide-prompts.spec.ts"],
  exports: [exported],
  originals: [original],
  lines: ({ pptx, parts, lists, ids, orders }) => [
    ...newSlideLines(parts),
    ...slideExportLines({
      pptx,
      parts,
      lists,
      ids,
      orders,
      kept: [...parts.get(original).keys()].filter((name) => !changedParts.has(name)),
      original,
      exported,
    }),
  ],
}
