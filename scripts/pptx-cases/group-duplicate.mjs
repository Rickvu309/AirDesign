import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const written = "written-group-duplicate.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()
const tolerance = 2
const inch = 914_400

const copies = [
  { node: "2799.11", x: inch, y: 0 },
  { node: "2799.9", x: 0, y: inch / 2 },
  { node: "2799.5", x: 0, y: inch },
]

const made = []

function painted(pptx, parts, part) {
  return new Map(
    pptx
      .paintReader(parts)
      .slide(part)
      .elements.filter((row) => row.from === "slide")
      .map((row) => [row.shape, row]),
  )
}

function near(left, right, x = 0, y = 0) {
  if (left === undefined || right === undefined || left === null || right === null) return false
  const wanted = { ...right, x: right.x + x, y: right.y + y }
  const sides = ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - wanted[side]) <= tolerance)
  return sides && Math.abs(left.rotation - right.rotation) < 0.01 && left.flipH === right.flipH
}

function xfrmOf(xml, shape) {
  const at = xml.indexOf(`<p:cNvPr id="${shape}"`)
  const start = xml.indexOf("<a:xfrm", at)
  return at < 0 || start < 0 ? null : xml.slice(start, xml.indexOf("</a:xfrm>", start))
}

export default {
  covers: [],
  written: [written],
  async write({ pptx, parts }) {
    const document = await import(documentBuild.href)
    const deck = parts.get(original)
    const { slides, elements } = pptx.indexPackage(deck)
    let register = {
      ...document.openRegister("", ""),
      index: { format: 2, total: elements.length, slides, elements, pages: [] },
    }
    const file = slides.map((slide) => slide.id)
    const free = Math.max(...elements.map((element) => Number(element.node.split(".")[1]) || 0)) + 1
    for (const copy of copies) {
      const shown = document.shownPlace(register, copy.node)
      if (shown === null) throw new Error(`group duplicate ${copy.node} has no place on the slide`)
      const node = document.nextElementId(register, "2799", free)
      const box = { ...shown.box, x: shown.box.x + copy.x, y: shown.box.y + copy.y }
      const cloned = document.cloneOf(register, copy.node, node, box)
      if (!cloned.ok) throw new Error(`group duplicate ${copy.node} ${cloned.refusal}`)
      const decision = document.decide(register, { command: "slide", file, edit: cloned.command })
      if (decision.decision !== "apply") throw new Error(`group duplicate ${copy.node} ${decision.code}`)
      register = decision.register
      const layers = (cloned.command.layers ?? []).map((layer) => [layer.source, layer.element.node])
      made.push({ ...copy, pairs: [[copy.node, node], ...layers] })
    }
    return [{ name: written, original, parts: pptx.exportParts(pptx.orderedParts(deck, register), register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || made.length === 0) return ["group duplicate not written"]
    const part = new Map(pptx.readSlides(before).map((row) => [row.slide, row.part])).get("2799")
    const kept = [...before.keys()].filter((name) => name !== part)
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "group duplicate"),
    )
    const [shown, now] = [painted(pptx, before, part), painted(pptx, after, part)]
    const [oldXml, newXml] = [decoder.decode(before.get(part)), decoder.decode(after.get(part))]
    const repeated = pptx.newDuplicateShapeIds(pptx.shapeIdCounts(before), pptx.shapeIdCounts(after))
    if (repeated.length > 0) lines.push(`group duplicate repeats shape ids ${repeated.map((row) => row.id).join(", ")}`)
    const copiedInto = new Set(["2799.11", "2799.4", "2799.5"])
    for (const { x, y, pairs } of made) {
      for (const [source, copy] of pairs) {
        const [from, to] = [source.split(".")[1], copy.split(".")[1]]
        if (now.get(from)?.kind === "p:grpSp") continue
        if (!near(now.get(to)?.box, now.get(from)?.box, x, y))
          lines.push(`group duplicate ${copy} does not show where ${source} does, moved by ${x}, ${y}`)
      }
    }
    for (const [shape, row] of shown) {
      if (copiedInto.has(`2799.${shape}`)) continue
      if (!near(now.get(shape)?.box, row.box)) lines.push(`group duplicate moved 2799.${shape}`)
      if (xfrmOf(newXml, shape) !== xfrmOf(oldXml, shape)) lines.push(`group duplicate rewrote 2799.${shape}`)
    }
    return lines
  },
}
