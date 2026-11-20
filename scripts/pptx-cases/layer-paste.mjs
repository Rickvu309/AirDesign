import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const written = "written-layer-paste.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()
const tolerance = 2

const pastes = [
  { node: "2726.6", onto: "2893", picture: true },
  { node: "2885.18", onto: "2890" },
  { node: "2727.1033", onto: "2892" },
]
const cut = "2726.6"

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

function near(left, right) {
  if (left === undefined || right === undefined || left === null || right === null) return false
  return ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - right[side]) <= tolerance)
}

function partsOf(pptx, parts) {
  return new Map(pptx.readSlides(parts).map((row) => [row.slide, row.part]))
}

function relsOf(part) {
  return part.replace("slides/", "slides/_rels/") + ".rels"
}

function linkedMedia(xml, rels, shape) {
  const at = xml.indexOf(`<p:cNvPr id="${shape}"`)
  const piece = at < 0 ? "" : xml.slice(at, xml.indexOf("</p:pic>", at))
  const embed = /r:embed="(rId[0-9]+)"/.exec(piece)?.[1]
  return embed === undefined ? null : (new RegExp(`Id="${embed}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? null)
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
    const placed = partsOf(pptx, deck)
    const apply = (edit) => {
      const decision = document.decide(register, { command: "slide", file, edit })
      if (decision.decision !== "apply") throw new Error(`layer paste ${decision.code}`)
      register = decision.register
    }
    for (const paste of pastes) {
      const shown = document.shownPlace(register, paste.node)
      if (shown === null) throw new Error(`layer paste ${paste.node} has no place on the slide`)
      const free = pptx.freeShapeId(deck, placed.get(paste.onto))
      const node = document.nextElementId(register, paste.onto, free)
      const pasted = document.cloneOf(register, paste.node, node, shown.box)
      if (!pasted.ok) throw new Error(`layer paste ${paste.node} ${pasted.refusal}`)
      apply(pasted.command)
      const layers = (pasted.command.layers ?? []).map((layer) => [layer.source, layer.element.node])
      made.push({ ...paste, pairs: [[paste.node, node], ...layers] })
    }
    apply({ slide: "element-remove", id: cut.split(".")[0], node: cut })
    return [{ name: written, original, parts: pptx.exportParts(pptx.orderedParts(deck, register), register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || made.length === 0) return ["layer paste not written"]
    const placed = partsOf(pptx, before)
    const touched = new Set([
      placed.get(cut.split(".")[0]),
      ...pastes.flatMap((paste) => [placed.get(paste.onto), relsOf(placed.get(paste.onto))]),
    ])
    const kept = [...before.keys()].filter((name) => !touched.has(name))
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "layer paste"),
    )
    const repeated = pptx.newDuplicateShapeIds(pptx.shapeIdCounts(before), pptx.shapeIdCounts(after))
    if (repeated.length > 0) lines.push(`layer paste repeats shape ids ${repeated.map((row) => row.id).join(", ")}`)
    for (const { node, onto, pairs, picture } of made) {
      const from = placed.get(node.split(".")[0])
      const to = placed.get(onto)
      const [shown, now] = [painted(pptx, before, from), painted(pptx, after, to)]
      for (const [source, copy] of pairs) {
        const [own, pasted] = [source.split(".")[1], copy.split(".")[1]]
        if (shown.get(own)?.kind === "p:grpSp") continue
        if (!near(now.get(pasted)?.box, shown.get(own)?.box))
          lines.push(`layer paste ${copy} does not show where ${source} does`)
      }
      const oldMedia = linkedMedia(
        decoder.decode(before.get(from)),
        decoder.decode(before.get(relsOf(from))),
        node.split(".")[1],
      )
      const newMedia = linkedMedia(
        decoder.decode(after.get(to)),
        decoder.decode(after.get(relsOf(to))),
        pairs[0][1].split(".")[1],
      )
      if (picture === true && (oldMedia === null || oldMedia !== newMedia))
        lines.push(`layer paste ${pairs[0][1]} links ${newMedia} where ${node} links ${oldMedia}`)
      for (const [shape, row] of painted(pptx, before, to))
        if (!near(painted(pptx, after, to).get(shape)?.box, row.box)) lines.push(`layer paste moved ${onto}.${shape}`)
    }
    const source = painted(pptx, after, placed.get(cut.split(".")[0]))
    if (source.has(cut.split(".")[1])) lines.push(`layer paste kept ${cut} after it was cut`)
    return lines
  },
}
