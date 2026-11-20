import { slideExportLines } from "../slide-export.mjs"

const original = "picture-shape-cropped.pptx"
const exported = "exported-mask-cropped.pptx"
const slide = "ppt/slides/slide1.xml"
const changed = new Set([slide, "ppt/slides/_rels/slide1.xml.rels", "[Content_Types].xml"])
const text = (bytes) => new TextDecoder().decode(bytes)

export default {
  specs: ["tests/browser/mask.spec.ts"],
  originals: [original],
  exports: [exported],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = text(answers.parts.get(exported)?.get(slide))
    const kept = [...(before?.keys() ?? [])].filter((name) => !changed.has(name))
    const headshot = /<p:pic><p:nvPicPr><p:cNvPr id="4" name="Headshot 4"\/>.*?<\/p:pic>/.exec(
      text(before?.get(slide)),
    )?.[0]
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(headshot !== undefined && after.includes(headshot) ? [] : ["the picture cropped to a circle changed"]),
    ]
  },
}
