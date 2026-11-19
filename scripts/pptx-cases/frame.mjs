import { slideExportLines } from "../slide-export.mjs"

const framed = { original: "blank.pptx", exported: "exported-frame.pptx", slide: "ppt/slides/slide1.xml" }
const laid = { original: "frame.pptx", exported: "exported-frame-layout.pptx", slide: "ppt/slides/slide1.xml" }
const faded = { original: "frame.pptx", exported: "exported-frame-faded.pptx", slide: "ppt/slides/slide1.xml" }

function caseLines(answers, { original, exported, slide }, touched, name) {
  const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((part) => !touched.includes(part))
  return slideExportLines({ ...answers, original, exported, kept }).map((line) => line.replace(/^slide export/, name))
}

function fadedLines(answers) {
  const parts = answers.parts.get(faded.exported)
  if (parts === undefined) return [`frame opacity has no ${faded.exported}`]
  const shown = (shape) => answers.pptx.shownAlphas(parts, { slide: "256", part: faded.slide, shape }).fills
  return ["3", "4", "5"].flatMap((shape) =>
    shown(shape) === 50000 ? [] : [`frame opacity does not read layer ${shape}'s fill at 50 percent`],
  )
}

export default {
  specs: [
    "tests/browser/auto-layout-frame.spec.ts",
    "tests/browser/auto-layout-design.spec.ts",
    "tests/browser/frame-opacity.spec.ts",
  ],
  exports: [framed.exported, laid.exported, faded.exported],
  renders: [framed.exported, laid.exported, faded.exported],
  covers: ["layout.flow", "layout.gap", "layout.padding", "layout.align", "layout.opacity"],
  lines(answers) {
    const added = [framed.slide, "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
    return [
      ...caseLines(answers, framed, added, "frame"),
      ...caseLines(answers, laid, [laid.slide, "ppt/tags/tag1.xml"], "frame layout"),
      ...caseLines(answers, faded, [faded.slide], "frame opacity"),
      ...fadedLines(answers),
    ]
  },
}
