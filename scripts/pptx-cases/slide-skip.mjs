import { slideExportLines } from "../slide-export.mjs"

const original = "nasa-1d-cnn.pptx"
const exported = "exported-slide-skip.pptx"
const slide = "ppt/slides/slide2.xml"
const text = (bytes) => new TextDecoder().decode(bytes)

export default {
  specs: ["tests/browser/present.spec.ts"],
  originals: [original],
  exports: [exported],
  covers: ["show.skipped"],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = answers.parts.get(exported)
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const opening = text(before?.get(slide))
    const expected = opening.replace(/<p:sld\b[^>]*>/, (root) => root.slice(0, -1) + ' show="0">')
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(opening !== expected && text(after?.get(slide)) === expected ? [] : ["skip changed more than p:sld/@show"]),
    ]
  },
}
