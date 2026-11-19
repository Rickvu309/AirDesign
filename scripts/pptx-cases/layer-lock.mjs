import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-layer-lock.pptx"
const slide = "ppt/slides/slide1.xml"
const text = (bytes) => new TextDecoder().decode(bytes)

export default {
  specs: ["tests/browser/layers-panel.spec.ts"],
  originals: [original],
  exports: [exported],
  covers: ["identity.locked"],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = answers.parts.get(exported)
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const opening = text(before?.get(slide))
    const expected = opening.replace(
      '<p:cNvPr id="2" name="Rectangle 2"/><p:cNvSpPr/>',
      '<p:cNvPr id="2" name="Rectangle 2"/><p:cNvSpPr><a:spLocks noMove="1" noResize="1" noRot="1"/></p:cNvSpPr>',
    )
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(opening !== expected && text(after?.get(slide)) === expected
        ? []
        : ["lock changed more than the shape's locks"]),
    ]
  },
}
