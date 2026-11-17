import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-element-link.pptx"
const slide = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"

export default {
  specs: ["tests/browser/control-link.spec.ts"],
  exports: [exported],
  originals: [original],
  renders: [exported],
  covers: ["link.target"],
  cases: [
    { name: "whole-element-link", before: original, after: exported, visible: false, errors: 0, dupes: 0, pages: true },
  ],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide && name !== rels)
    const lines = slideExportLines({ ...answers, original, exported, kept })
    const target = answers.pptx.shownLink(answers.parts.get(exported), { slide: "256", part: slide, shape: "2" })
    if (target?.kind !== "url" || target.url !== "https://example.com")
      lines.push("whole-element link destination missing")
    return lines
  },
}
