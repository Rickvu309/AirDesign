import { slideExportLines } from "../slide-export.mjs"

const original = "nasa-cots-electronics.pptx"
const exported = "exported-shape-effects.pptx"
const glowing = "ppt/slides/slide7.xml"
const softened = "ppt/slides/slide8.xml"
const styleShadow =
  '<a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw>'
const glowList = `<a:effectLst><a:glow rad="63500"><a:schemeClr val="accent2"><a:alpha val="40000"/></a:schemeClr></a:glow>${styleShadow}</a:effectLst></p:spPr>`
const softList =
  '<a:effectLst><a:outerShdw blurRad="40000" dist="76200" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="35000"/></a:srgbClr></a:outerShdw><a:softEdge rad="63500"/></a:effectLst></p:spPr>'
const styles = /<p:style>.*?<\/p:style>/gs

export default {
  specs: ["tests/browser/shape-effects.spec.ts"],
  exports: [exported],
  originals: [original],
  renders: [exported],
  covers: ["effects.shadow", "effects.innerShadow", "effects.glow", "effects.softEdge", "effects.blur"],
  lines(answers) {
    const kept = [...(answers.parts.get(original)?.keys() ?? [])].filter(
      (name) => name !== glowing && name !== softened,
    )
    const lines = slideExportLines({ ...answers, original, exported, kept }).map((line) =>
      line.replace(/^slide export/, "shape effects"),
    )
    const decode = (name, part) => new TextDecoder().decode(answers.parts.get(name)?.get(part) ?? new Uint8Array())
    const theme = decode(original, "ppt/theme/theme1.xml")
    if (!theme.includes(`<a:effectStyle><a:effectLst>${styleShadow}</a:effectLst></a:effectStyle>`))
      lines.push("shape effects: the theme no longer holds the style shadow the case copies")
    if (!decode(exported, glowing).includes(glowList))
      lines.push("shape effects did not copy the style's shadow byte for byte before the glow")
    if (!decode(exported, softened).includes(softList))
      lines.push("shape effects did not move only the shadow's distance and add the soft edge")
    for (const part of [glowing, softened]) {
      if (JSON.stringify(decode(exported, part).match(styles)) !== JSON.stringify(decode(original, part).match(styles)))
        lines.push(`shape effects changed a style reference in ${part}`)
    }
    const shown = answers.pptx.shownEffects(answers.parts.get(exported), { part: glowing, shape: "4" })
    if (shown?.glow.value?.halo?.radius !== 63500 || shown?.shadow.value?.outer?.distance !== 23000)
      lines.push("shape effects does not read the glow and the copied shadow it wrote")
    return lines
  },
}
