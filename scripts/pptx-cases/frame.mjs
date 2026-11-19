import { slideExportLines } from "../slide-export.mjs"

const framed = { original: "blank.pptx", exported: "exported-frame.pptx", slide: "ppt/slides/slide1.xml" }
const laid = { original: "frame.pptx", exported: "exported-frame-layout.pptx", slide: "ppt/slides/slide1.xml" }

function caseLines(answers, { original, exported, slide }, touched, name) {
  const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((part) => !touched.includes(part))
  return slideExportLines({ ...answers, original, exported, kept }).map((line) => line.replace(/^slide export/, name))
}

export default {
  specs: ["tests/browser/auto-layout-frame.spec.ts", "tests/browser/auto-layout-design.spec.ts"],
  exports: [framed.exported, laid.exported],
  renders: [framed.exported, laid.exported],
  covers: ["layout.flow", "layout.gap", "layout.padding", "layout.align"],
  lines(answers) {
    const added = [framed.slide, "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
    return [
      ...caseLines(answers, framed, added, "frame"),
      ...caseLines(answers, laid, [laid.slide, "ppt/tags/tag1.xml"], "frame layout"),
    ]
  },
}
