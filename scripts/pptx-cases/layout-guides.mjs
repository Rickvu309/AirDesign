import { slideExportLines } from "../slide-export.mjs"

const original = "census-updating-spm.pptx"
const exported = "exported-layout-guides.pptx"
const slide = "ppt/slides/slide1.xml"
const extension =
  /<p:extLst><p:ext uri="\{69A285BF-2CD7-437C-98FB-1F09AAAED3C1\}"><ag:layoutGuides xmlns:ag="https:\/\/airdesign\.app\/2026\/guides">(?:<ag:layoutGuide [^>]*\/>)*<\/ag:layoutGuides><\/p:ext><\/p:extLst><\/p:sld>$/
const columns = {
  pattern: "columns",
  count: 5,
  align: "stretch",
  size: 127_000,
  offset: 0,
  gutter: 254_000,
  color: "FF0000",
  opacity: 10,
  shown: true,
}
const text = (bytes) => new TextDecoder().decode(bytes)

export default {
  specs: ["tests/browser/layout-guides.spec.ts"],
  originals: [original],
  exports: [exported],
  covers: ["guides.layout"],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = answers.parts.get(exported)
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const opening = text(before?.get(slide))
    const written = text(after?.get(slide))
    const head = opening.slice(0, opening.length - "</p:sld>".length)
    const read = after === undefined ? [] : answers.pptx.readLayoutGuideList(after, slide)
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(written.startsWith(head) && extension.test(written.slice(head.length))
        ? []
        : ["layout guides changed more than one AirDesign extension at the end of the slide"]),
      ...(JSON.stringify(read) === JSON.stringify([columns])
        ? []
        : [`layout guides read back as ${JSON.stringify(read)}`]),
      ...(answers.pptx.readSlideGuides(after ?? new Map(), slide).length ===
      answers.pptx.readSlideGuides(before ?? new Map(), slide).length
        ? []
        : ["the slide's guides changed"]),
    ]
  },
}
