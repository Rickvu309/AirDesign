import { slideExportLines } from "../slide-export.mjs"

const original = "shapes-added.pptx"
const exported = "exported-shape-fill.pptx"
const slides = ["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"]
const deckParts = ["[Content_Types].xml", "ppt/_rels/presentation.xml.rels", "ppt/presentation.xml", slides[0]]
const solid =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent2"><a:alpha val="100000"/></a:schemeClr></a:solidFill></p:spPr><p:style><a:lnRef idx="2">'
const gradient =
  /<a:prstGeom prst="ellipse"><a:avLst\/><\/a:prstGeom><a:gradFill rotWithShape="0"><a:gsLst><a:gs pos="0"><a:schemeClr val="accent1"><a:alpha val="100000"\/><\/a:schemeClr><\/a:gs><a:gs pos="100000"><a:schemeClr val="lt1"><a:alpha val="100000"\/><\/a:schemeClr><\/a:gs><\/a:gsLst><a:lin ang="5400000" scaled="0"\/><\/a:gradFill><\/p:spPr><p:style>/

export default {
  specs: ["tests/browser/shape-fill.spec.ts"],
  exports: [exported],
  renders: [exported],
  covers: ["fill.value"],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => !deckParts.includes(name))
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "shape fill"),
    )
    for (const slide of slides) {
      const bytes = answers.parts.get(exported)?.get(slide)
      const text = bytes === undefined ? "" : new TextDecoder().decode(bytes)
      if (!text.includes(solid))
        lines.push(`shape fill ${slide} did not write the rectangle's own accent2 fill before its style`)
      if (!gradient.test(text))
        lines.push(`shape fill ${slide} did not write the oval's linear gradient before its style`)
    }
    return lines
  },
}
