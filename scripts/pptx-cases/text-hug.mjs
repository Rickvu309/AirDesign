import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const slide = "ppt/slides/slide1.xml"
const exported = "exported-text-hug.pptx"
const hugging = '<a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" wrap="none"><a:spAutoFit/></a:bodyPr>'

export default {
  specs: ["tests/browser/text-hug.spec.ts"],
  exports: [exported],
  cases: [
    {
      name: "browser-text-hug",
      before: original,
      after: exported,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [exported],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "new text"),
    )
    const xml = new TextDecoder().decode(answers.parts.get(exported)?.get(slide) ?? new Uint8Array())
    const added = xml.slice(xml.lastIndexOf("<p:sp>"))
    if (!added.includes(hugging)) lines.push("new text is not an auto width box with no inset")
    if (added.includes("algn=")) lines.push("new text is not left aligned")
    return lines
  },
}
