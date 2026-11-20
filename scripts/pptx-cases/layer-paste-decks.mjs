import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const source = "doe-heat-pumps.pptx"
const original = "clean.pptx"
const written = "written-layer-paste-decks.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()
const part = "ppt/slides/slide1.xml"
const rels = "ppt/slides/_rels/slide1.xml.rels"
const tolerance = 2

const pastes = [
  { node: "2726.6", picture: true },
  { node: "2885.18", picture: false },
]

const made = []

function partsOf(pptx, parts) {
  return new Map(pptx.readSlides(parts).map((row) => [row.slide, row.part]))
}

function painted(pptx, parts, slidePart) {
  return new Map(
    pptx
      .paintReader(parts)
      .slide(slidePart)
      .elements.filter((row) => row.from === "slide")
      .map((row) => [row.shape, row]),
  )
}

function near(left, right) {
  if (left === undefined || right === undefined || left === null || right === null) return false
  return ["width", "height"].every((side) => Math.abs(left[side] - right[side]) <= tolerance)
}

function below(elements, top) {
  const found = []
  const reach = (parent) => {
    for (const element of elements.filter((each) => each.group === parent)) {
      found.push(element)
      reach(element.node)
    }
  }
  reach(top)
  return found
}

function hexOf(index) {
  return index.toString(16).padStart(64, "0")
}

export default {
  covers: [],
  written: [written],
  async write({ pptx, parts }) {
    const document = await import(documentBuild.href)
    const from = parts.get(source)
    const deck = parts.get(original)
    const sourceIndex = pptx.indexPackage(from)
    const { slides, elements } = pptx.indexPackage(deck)
    let register = {
      ...document.openRegister("", ""),
      index: { format: 2, total: elements.length, slides, elements, pages: [] },
    }
    const file = slides.map((slide) => slide.id)
    const sourceParts = partsOf(pptx, from)
    const bytes = new Map()
    let free = pptx.freeShapeId(deck, part)
    for (const [at, paste] of pastes.entries()) {
      const carried = pptx.carriedShape(from, sourceParts.get(paste.node.split(".")[0]), paste.node.split(".")[1])
      if (carried === null) throw new Error(`layer paste decks ${paste.node} not carried`)
      const media = carried.images.map((image, index) => {
        const sha256 = hexOf(at * 16 + index + 1)
        bytes.set(sha256, image.bytes)
        return { sha256, type: image.type }
      })
      const top = sourceIndex.elements.find((element) => element.node === paste.node)
      const inside = below(sourceIndex.elements, paste.node)
      const nodes = new Map(
        [paste.node, ...inside.map((each) => each.node)].map((node, index) => [node, `256.${free + index}`]),
      )
      free += nodes.size
      const node = nodes.get(paste.node)
      const element = { node, kind: top.kind, value: top.value, box: { ...top.box, x: 0, y: 0 }, grouped: false }
      const layers = inside.map((each) => ({
        shape: each.node.split(".")[1],
        element: {
          node: nodes.get(each.node),
          kind: each.kind,
          value: each.value,
          box: each.box,
          grouped: true,
          group: nodes.get(each.group),
        },
      }))
      const edit = {
        slide: "element-add",
        id: "256",
        element,
        pasted: { markup: carried.markup, shape: paste.node.split(".")[1], media, layers },
      }
      const decision = document.decide(register, { command: "slide", file, edit })
      if (decision.decision !== "apply") throw new Error(`layer paste decks ${paste.node} ${decision.code}`)
      register = decision.register
      made.push({ ...paste, pairs: [...nodes] })
    }
    const media = (sha256) => bytes.get(sha256)
    return [
      {
        name: written,
        original,
        parts: pptx.exportParts(pptx.orderedParts(deck, register, media), register, media),
      },
    ]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    const from = parts.get(source)
    if (before === undefined || after === undefined || made.length === 0) return ["layer paste decks not written"]
    const added = [...after.keys()].filter((name) => !before.has(name))
    const kept = [...before.keys()].filter((name) => name !== part && name !== rels && name !== "[Content_Types].xml")
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "layer paste decks"),
    )
    const repeated = pptx.newDuplicateShapeIds(pptx.shapeIdCounts(before), pptx.shapeIdCounts(after))
    if (repeated.length > 0)
      lines.push(`layer paste decks repeats shape ids ${repeated.map((row) => row.id).join(", ")}`)
    const now = painted(pptx, after, part)
    for (const { node, pairs } of made) {
      const shown = painted(pptx, from, partsOf(pptx, from).get(node.split(".")[0]))
      for (const [sourceNode, copy] of pairs) {
        const [own, pasted] = [sourceNode.split(".")[1], copy.split(".")[1]]
        if (shown.get(own)?.kind === "p:grpSp") continue
        if (!near(now.get(pasted)?.box, shown.get(own)?.box))
          lines.push(`layer paste decks ${copy} is not the size ${sourceNode} is`)
      }
    }
    const pictures = added.filter((name) => name.startsWith("ppt/media/"))
    if (pictures.length !== 1) lines.push(`layer paste decks added ${pictures.length} image parts, not 1`)
    const xml = decoder.decode(after.get(part))
    if (xml.includes("pasted0")) lines.push("layer paste decks left a pasted image reference unlinked")
    return lines
  },
}
