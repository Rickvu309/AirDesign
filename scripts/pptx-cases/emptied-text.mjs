import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const slide = "ppt/slides/slide1.xml"
const exported = "exported-emptied-text.pptx"

export default {
  specs: ["tests/browser/emptied-text.spec.ts"],
  exports: [exported],
  cases: [
    {
      name: "browser-emptied-text",
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
      line.replace(/^slide export/, "emptied text"),
    )
    const xml = new TextDecoder().decode(answers.parts.get(exported)?.get(slide) ?? new Uint8Array())
    const before = new TextDecoder().decode(answers.parts.get(original)?.get(slide) ?? new Uint8Array())
    const added = xml.split("<p:sp>").length - before.split("<p:sp>").length
    if (added !== 1) lines.push(`emptied text left ${String(added)} new shapes, not 1`)
    if (!xml.includes("Kept words")) lines.push("the kept text is missing")
    if (xml.includes("Gone words")) lines.push("the removed text is still in the slide")
    return lines
  },
}
