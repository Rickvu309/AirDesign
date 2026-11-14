import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-shape-geometry.pptx"
const slide = "ppt/slides/slide1.xml"
const turned =
  '<p:spPr><a:xfrm rot="2700000" flipH="1"><a:off x="3352800" y="457200"/><a:ext cx="5486400" cy="1828800"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></p:spPr>'

export default {
  specs: ["tests/browser/shape-geometry.spec.ts"],
  exports: [exported],
  renders: [exported],
  covers: ["geometry.shape", "box.rot", "box.flipH", "box.flipV"],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "shape geometry"),
    )
    const bytes = answers.parts.get(exported)?.get(slide)
    const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
    if (!text.includes(turned))
      lines.push(`shape geometry ${slide} did not write the turned, flipped rounded rectangle with its own corner`)
    return lines
  },
}
