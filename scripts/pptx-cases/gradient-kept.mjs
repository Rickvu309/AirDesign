import { slideExportLines } from "../slide-export.mjs"

const original = "nasa-lessons-capture-eee.pptx"
const exported = "exported-gradient-kept.pptx"
const slide = "ppt/slides/slide2.xml"
const linear =
  /<a:prstGeom prst="ellipse"><a:avLst\/><\/a:prstGeom><a:gradFill flip="none" rotWithShape="1"><a:gsLst>.*?<\/a:gsLst><a:lin ang="\d+" scaled="[01]"\/><a:tileRect\/><\/a:gradFill>/

export default {
  specs: ["tests/browser/gradient-kept.spec.ts"],
  exports: [exported],
  originals: [original],
  renders: [exported],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "gradient kept"),
    )
    const text = new TextDecoder().decode(answers.parts.get(exported)?.get(slide) ?? new Uint8Array())
    if (!linear.test(text))
      lines.push(`gradient kept ${slide} did not keep the oval's flip and tile rectangle on its linear gradient`)
    return lines
  },
}
