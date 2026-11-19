import { slideExportLines } from "../slide-export.mjs"

const framed = { original: "blank.pptx", exported: "exported-frame.pptx", slide: "ppt/slides/slide1.xml" }

export default {
  specs: ["tests/browser/auto-layout-frame.spec.ts"],
  exports: [framed.exported],
  renders: [framed.exported],
  lines(answers) {
    const { original, exported, slide } = framed
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    return slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "frame"),
    )
  },
}
