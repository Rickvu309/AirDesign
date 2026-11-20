import { slideExportLines } from "../slide-export.mjs"

const sized = { original: "frame.pptx", exported: "exported-frame-sized.pptx", slide: "ppt/slides/slide1.xml" }
const tag = "ppt/tags/tag1.xml"

function sizingLines(answers) {
  const parts = answers.parts.get(sized.exported)
  if (parts === undefined) return [`frame sizing has no ${sized.exported}`]
  const framed = answers.pptx.indexPackage(parts).elements.find((element) => element.framing !== undefined)
  const layout = framed?.framing?.layout
  return [
    ...(layout?.width === "fixed" ? [] : ["frame sizing does not read the frame's width back as Fixed"]),
    ...(layout?.height === "fixed" ? [] : ["frame sizing does not read the frame's height back as Fixed"]),
  ]
}

export default {
  specs: ["tests/browser/frame-sizing.spec.ts"],
  exports: [sized.exported],
  renders: [sized.exported],
  covers: ["layout.width", "layout.height"],
  lines(answers) {
    const kept = [...(answers.parts.get(sized.original)?.keys() ?? [])].filter(
      (part) => part !== sized.slide && part !== tag,
    )
    return [
      ...slideExportLines({ ...answers, original: sized.original, exported: sized.exported, kept }).map((line) =>
        line.replace(/^slide export/, "frame sizing"),
      ),
      ...sizingLines(answers),
    ]
  },
}
