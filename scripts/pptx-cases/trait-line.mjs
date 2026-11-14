import { slideExportLines } from "../slide-export.mjs"

const original = "shapes-added.pptx"
const exported = "exported-line-style.pptx"
const slide = "ppt/slides/slide1.xml"
const rectangle =
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:ln w="76200"><a:prstDash val="lgDash"/></a:ln></p:spPr>'
const connector =
  '<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln><a:tailEnd type="triangle" w="lg" len="med"/></a:ln></p:spPr>'
const styles = /<p:style>.*?<\/p:style>/g
const styleColor = { solid: { scheme: "accent1", transforms: [{ op: "shade", val: 15000 }] } }

export default {
  specs: ["tests/browser/line-style.spec.ts"],
  exports: [exported],
  cases: [
    {
      name: "browser-line-style",
      before: original,
      after: exported,
      visible: true,
      targeted: [1],
      errors: 0,
      dupes: 0,
      pages: true,
    },
  ],
  renders: [exported],
  covers: ["line.fill", "line.width", "line.dash", "line.cap", "line.compound", "line.join", "line.head", "line.tail"],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter((name) => name !== slide)
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "line style"),
    )
    const decode = (name) => new TextDecoder().decode(answers.parts.get(name)?.get(slide) ?? new Uint8Array())
    const before = decode(original)
    const after = decode(exported)
    if (!after.includes(rectangle)) lines.push("line style did not write only the width and dash into the style line")
    if (!after.includes(connector)) lines.push("line style did not write the connector's end arrow")
    if (JSON.stringify(after.match(styles)) !== JSON.stringify(before.match(styles)))
      lines.push("line style changed a shape's style reference")
    const shown = answers.pptx.shownLine(answers.parts.get(exported), { part: slide, shape: "4" })
    if (JSON.stringify(shown?.fill) !== JSON.stringify({ value: styleColor, own: false }))
      lines.push("line style lost the colour the rectangle's style line gives it")
    if (shown?.width.value !== 76200 || shown?.dash.value !== "lgDash")
      lines.push("line style does not read the width and dash it wrote")
    return lines
  },
}
