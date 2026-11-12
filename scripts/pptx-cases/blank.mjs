import { blankCase, blankExportLines, blankExportName, blankOriginalName } from "../blank-export.mjs"
import { slideExportLines } from "../slide-export.mjs"

const blankSlidesName = "exported-blank-slides.pptx"
const changedParts = new Set(["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"])

export default {
  specs: ["tests/browser/blank-deck.spec.ts"],
  exports: [blankExportName, blankSlidesName],
  cases: [blankCase],
  renders: [blankExportName],
  lines: ({ pptx, parts, lists, ids, orders }) => [
    ...blankExportLines({ pptx, parts, lists }),
    ...slideExportLines({
      pptx,
      parts,
      lists,
      ids,
      orders,
      kept: [...parts.get(blankOriginalName).keys()].filter((name) => !changedParts.has(name)),
      original: blankOriginalName,
      exported: blankSlidesName,
    }),
  ],
}
