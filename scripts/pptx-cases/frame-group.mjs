import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "nested-groups.pptx"
const written = "written-frame-group.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const tolerance = 2

const wanted = new Map()

function landed(document, register, node, patch) {
  let current = register
  if (!current.nodes.includes(node)) {
    const opened = document.decide(current, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(`frame group ${node} ${opened.code}`)
    current = opened.register
  }
  const decision = document.decide(current, { command: "person", node, v: document.format, patch })
  if (decision.decision !== "apply") throw new Error(`frame group ${node} ${decision.code}`)
  return decision.register
}

function near(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) return false
  return [
    ["x", "x"],
    ["y", "y"],
    ["width", "cx"],
    ["height", "cy"],
  ].every(([side, key]) => Math.abs(left[side] - right.box[key]) <= tolerance)
}

export default {
  covers: [],
  originals: [original],
  written: [written],
  async write({ pptx, parts }) {
    const document = await import(documentBuild.href)
    const deck = parts.get(original)
    const { slides, elements } = pptx.indexPackage(deck)
    const slide = slides[0].id
    const node = (shape) => `${slide}.${shape}`
    const turned = { "box.rot": [30], "box.flipH": [true] }
    const designed = elements.map((element) => (element.node === node(3) ? { ...element, design: turned } : element))
    let register = {
      ...document.openRegister("", ""),
      index: { format: 2, total: designed.length, slides, elements: designed, pages: [] },
    }
    const made = document.changeLayout(register, {
      wrap: [node(2), node(7)],
      slide,
      node: node(20),
      backdrop: node(21),
    })
    if (made === null || !("slide" in made)) throw new Error("frame group wrap refused")
    const wrapped = document.decide(register, { command: "slide", file: [slide], edit: made.slide })
    if (wrapped.decision !== "apply") throw new Error(`frame group wrap ${wrapped.code}`)
    register = wrapped.register
    const shown = document.shownPlace(register, node(4))
    if (shown === null) throw new Error("frame group leaf has no place on the slide")
    const plan = document.planChange(
      { target: { node: node(4) }, box: { x: shown.box.x + 400_000, y: shown.box.y + 1_200_000 } },
      document.registerScope(register),
    )
    if (!plan.ok) throw new Error(`frame group ${plan.refusals[0]?.code}`)
    for (const { node: at, row } of plan.rows) register = landed(document, register, at, row.patch)
    for (const shape of [4, 5, 6]) wanted.set(shape, document.shownPlace(register, node(shape)))
    return [{ name: written, original, parts: pptx.exportParts(pptx.orderedParts(deck, register), register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || wanted.size === 0) return ["frame group not written"]
    const part = pptx.readSlides(before)[0]?.part
    const touched = [part, "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
    const kept = [...before.keys()].filter((name) => !touched.includes(name))
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "frame group"),
    )
    const now = new Map(
      pptx
        .paintReader(after)
        .slide(part)
        .elements.map((row) => [Number(row.shape), row.box]),
    )
    for (const [shape, place] of wanted)
      if (!near(now.get(shape), place)) lines.push(`frame group shape ${shape} does not paint where the deck shows it`)
    return lines
  },
}
