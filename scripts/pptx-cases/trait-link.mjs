import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-element-link.pptx"
const slide = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"

export default {
  specs: ["tests/browser/control-link.spec.ts"],
  exports: [exported, "exported-phrase-link.pptx"],
  originals: [original],
  renders: [exported, "exported-phrase-link.pptx"],
  covers: ["link.target"],
  cases: [
    {
      name: "phrase-link",
      before: original,
      after: "exported-phrase-link.pptx",
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
    { name: "whole-element-link", before: original, after: exported, visible: false, errors: 0, dupes: 0, pages: true },
  ],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide && name !== rels)
    const lines = slideExportLines({ ...answers, original, exported, kept })
    const target = answers.pptx.shownLink(answers.parts.get(exported), { slide: "256", part: slide, shape: "2" })
    if (target?.kind !== "url" || target.url !== "https://example.com")
      lines.push("whole-element link destination missing")
    const phrase = answers.pptx.shownLink(answers.parts.get("exported-phrase-link.pptx"), {
      slide: "256",
      part: slide,
      shape: "2",
      paragraph: 0,
      run: 1,
    })
    if (phrase?.kind !== "url" || phrase.url !== "https://example.com/phrase")
      lines.push("phrase link destination missing")
    return lines
  },
}
