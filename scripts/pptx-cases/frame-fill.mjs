import { slideExportLines } from "../slide-export.mjs"

const filled = { original: "frame.pptx", exported: "exported-frame-fill.pptx", slide: "ppt/slides/slide1.xml" }
const tag = "ppt/tags/tag1.xml"

function fillLines(answers) {
  const parts = answers.parts.get(filled.exported)
  if (parts === undefined) return [`frame fill has no ${filled.exported}`]
  const framed = answers.pptx.indexPackage(parts).elements.find((element) => element.framing !== undefined)
  const fill = framed?.framing?.fills?.find((each) => each.node.endsWith(".5"))
  return fill?.width === true && fill.height === true
    ? []
    : ["frame fill does not read the oval back as filling both sides"]
}

export default {
  specs: ["tests/browser/frame-fill.spec.ts"],
  exports: [filled.exported],
  renders: [filled.exported],
  covers: ["layout.width", "layout.height"],
  lines(answers) {
    const kept = [...(answers.parts.get(filled.original)?.keys() ?? [])].filter(
      (part) => part !== filled.slide && part !== tag,
    )
    return [
      ...slideExportLines({ ...answers, original: filled.original, exported: filled.exported, kept }).map((line) =>
        line.replace(/^slide export/, "frame fill"),
      ),
      ...fillLines(answers),
    ]
  },
}
