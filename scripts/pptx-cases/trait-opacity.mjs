import { slideExportLines } from "../slide-export.mjs"

const slide = "ppt/slides/slide1.xml"
const styled = { original: "shapes-added.pptx", exported: "exported-opacity.pptx" }
const texted = { original: "clean.pptx", exported: "exported-opacity-text.pptx" }
const styles = /<p:style>.*?<\/p:style>/g
const oval =
  '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="accent1"><a:alpha val="60000"/></a:schemeClr></a:solidFill><a:ln><a:solidFill><a:schemeClr val="accent1"><a:shade val="15000"/><a:alpha val="60000"/></a:schemeClr></a:solidFill></a:ln></p:spPr>'
const run =
  '<a:rPr lang="en-US" sz="3200"><a:solidFill><a:schemeClr val="dk1"><a:alpha val="50000"/></a:schemeClr></a:solidFill></a:rPr><a:t>Hello</a:t>'

export default {
  specs: ["tests/browser/opacity.spec.ts"],
  exports: [styled.exported, texted.exported],
  cases: [styled, texted].map(({ original, exported }) => ({
    name: `browser-${exported.replace(/^exported-|\.pptx$/g, "")}`,
    before: original,
    after: exported,
    visible: true,
    targeted: [1],
    errors: 0,
    dupes: 0,
    pages: true,
  })),
  renders: [styled.exported, texted.exported],
  covers: ["fills.alpha", "border.alpha", "text.alpha"],
  lines(answers) {
    const decode = (name) => new TextDecoder().decode(answers.parts.get(name)?.get(slide) ?? new Uint8Array())
    const lines = [styled, texted].flatMap(({ original, exported }) => {
      const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
      return slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, `opacity ${exported}`),
      )
    })
    const before = decode(styled.original)
    const after = decode(styled.exported)
    if (!after.includes(oval))
      lines.push("opacity did not copy the oval's style fill and border as its own and fade them")
    if (JSON.stringify(after.match(styles)) !== JSON.stringify(before.match(styles)))
      lines.push("opacity changed a shape's style reference")
    const parts = answers.parts.get(styled.exported)
    const shown = (shape) => answers.pptx.shownAlphas(parts, { slide: "256", part: slide, shape })
    if (JSON.stringify(shown("5")) !== JSON.stringify({ fills: 60000, border: 60000, text: null }))
      lines.push("opacity does not read the oval's fill and border at 60 percent")
    if (shown("6").border !== 40000) lines.push("opacity does not read the connector's border at 40 percent")
    if (answers.pptx.shownBorder(parts, { part: slide, shape: "5" })?.width.own !== false)
      lines.push("opacity lost the border width the oval's style gives it")
    if (!decode(texted.exported).includes(run)) lines.push("opacity did not write the alpha on the text's run")
    return lines
  },
}
