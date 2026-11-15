import { groupLines } from "../group-export.mjs"
import { slideExportLines } from "../slide-export.mjs"

const grouped = { original: "blank.pptx", exported: "exported-group.pptx", slide: "ppt/slides/slide1.xml" }
const ungrouped = { original: "doe-heat-pumps.pptx", exported: "exported-ungroup.pptx", slide: "ppt/slides/slide8.xml" }

export default {
  specs: ["tests/browser/group.spec.ts"],
  exports: [grouped.exported, ungrouped.exported],
  renders: [grouped.exported, ungrouped.exported],
  lines(answers) {
    const judged = ({ original, exported, slide }, word) => {
      const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
      return slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, word),
      )
    }
    return [...judged(grouped, "group"), ...judged(ungrouped, "ungroup"), ...groupLines(answers)]
  },
}
