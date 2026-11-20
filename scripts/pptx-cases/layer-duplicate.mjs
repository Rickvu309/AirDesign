import { slideExportLines } from "../slide-export.mjs"

const original = "clean.pptx"
const exported = "exported-layer-duplicate.pptx"
const slide = "ppt/slides/slide1.xml"
const text = (bytes) => new TextDecoder().decode(bytes)
const placedAt = '<a:off x="457200" y="457200"/>'

function copied(piece, id, x, y) {
  return piece.replace('<p:cNvPr id="2" ', `<p:cNvPr id="${id}" `).replace(placedAt, `<a:off x="${x}" y="${y}"/>`)
}

export default {
  specs: ["tests/browser/layer-duplicate.spec.ts"],
  originals: [original],
  exports: [exported],
  lines(answers) {
    const before = answers.parts.get(original)
    const after = answers.parts.get(exported)
    const kept = [...(before?.keys() ?? [])].filter((name) => name !== slide)
    const opening = text(before?.get(slide))
    const start = opening.indexOf("<p:sp>")
    const piece = opening.slice(start, opening.indexOf("</p:sp>", start) + "</p:sp>".length)
    const expected = opening.replace(
      piece,
      piece + copied(piece, 3, 1066800, 2743200) + copied(piece, 4, 1676400, 5029200),
    )
    return [
      ...slideExportLines({ ...answers, original, exported, kept }).map((line) =>
        line.replace(/^slide export/, "layer duplicate"),
      ),
      ...(piece.includes(placedAt) && text(after?.get(slide)) === expected
        ? []
        : ["layer duplicate changed more than two new shapes after the original"]),
    ]
  },
}
