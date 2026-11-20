import { slideExportLines } from "../slide-export.mjs"

const original = "census-updating-spm.pptx"
const exported = "exported-slide-guides.pptx"
const slide = "ppt/slides/slide1.xml"
const extension =
  /<p:extLst><p:ext uri="\{B7EA18BA-A583-420B-AA80-A42F3E0419E5\}"><ag:guides xmlns:ag="https:\/\/airdesign\.app\/2026\/guides">(?:<ag:guide axis="[xy]" offset="-?\d+"\/>)*<\/ag:guides><\/p:ext><\/p:extLst><\/p:sld>$/
const text = (bytes) => new TextDecoder().decode(bytes)

export default {
  specs: ["tests/browser/slide-guides.spec.ts"],
  originals: [original],
  exports: [exported],
  covers: ["guides.ruler"],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = answers.parts.get(exported)
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const opening = text(before?.get(slide))
    const written = text(after?.get(slide))
    const head = opening.slice(0, opening.length - "</p:sld>".length)
    const inherited = answers.pptx.readSlideGuides(before, slide).filter((guide) => guide.offset !== 6_096_000)
    const read = after === undefined ? [] : answers.pptx.readSlideGuides(after, slide)
    const added = read.slice(inherited.length)
    return [
      ...slideExportLines({ ...answers, original, exported, kept }),
      ...(written.startsWith(head) && extension.test(written.slice(head.length))
        ? []
        : ["slide guides changed more than one AirDesign extension at the end of the slide"]),
      ...(JSON.stringify(read.slice(0, inherited.length)) === JSON.stringify(inherited) &&
      added.length === 1 &&
      added[0]?.axis === "y"
        ? []
        : [`slide guides read back as ${JSON.stringify(read)}`]),
      ...(answers.pptx.readSlideGuides(after ?? new Map(), "ppt/slides/slide2.xml").length ===
      answers.pptx.readSlideGuides(before ?? new Map(), "ppt/slides/slide2.xml").length
        ? []
        : ["another slide's guides changed"]),
    ]
  },
}
