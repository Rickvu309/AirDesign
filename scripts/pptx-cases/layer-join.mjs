import { slideExportLines } from "../slide-export.mjs"

const original = "blank.pptx"
const exported = "exported-layer-join.pptx"
const slide = "ppt/slides/slide1.xml"
const text = (bytes) => new TextDecoder().decode(bytes)

function groupOf(markup, id) {
  const start = markup.indexOf(`<p:cNvPr id="${id}" `)
  const open = markup.lastIndexOf("<p:grpSp>", start)
  const close = markup.indexOf("</p:grpSp>", start)
  return open < 0 || close < 0 ? "" : markup.slice(open, close)
}

export default {
  specs: ["tests/browser/layers-drag.spec.ts"],
  originals: [original],
  exports: [exported],
  renders: [exported],
  lines(answers) {
    const before = answers.parts.get(original)
    const markup = text(answers.parts.get(exported)?.get(slide))
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const group = groupOf(markup, 7)
    const inside = [4, 6].every((id) => group.includes(`<p:cNvPr id="${id}" `))
    return [
      ...slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, "layer join"),
      ),
      ...(inside && !group.includes('<p:cNvPr id="5" ')
        ? []
        : ["layer join: the group does not hold the layer dragged into it, or still holds the one dragged out"]),
    ]
  },
}
