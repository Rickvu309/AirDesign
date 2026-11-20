import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "shapes-added.pptx"
const written = "written-frame-nested.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const tolerance = 2
const point = 12_700

const wanted = new Map()
const frames = new Map()

function landed(document, register, node, patch) {
  let current = register
  if (!current.nodes.includes(node)) {
    const opened = document.decide(current, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(`frame nested ${node} ${opened.code}`)
    current = opened.register
  }
  const decision = document.decide(current, { command: "person", node, v: document.format, patch })
  if (decision.decision !== "apply") throw new Error(`frame nested ${node} ${decision.code}`)
  return decision.register
}

function wrapped(document, register, slide, wrap, node, backdrop) {
  const made = document.changeLayout(register, { wrap, slide, node, backdrop })
  if (made === null || !("slide" in made)) throw new Error(`frame nested wrap of ${wrap.join(", ")} refused`)
  const decision = document.decide(register, { command: "slide", file: [slide], edit: made.slide })
  if (decision.decision !== "apply") throw new Error(`frame nested wrap ${decision.code}`)
  return decision.register
}

function near(left, right) {
  if (left === undefined || left === null || right === undefined) return false
  return [
    ["x", "x"],
    ["y", "y"],
    ["width", "cx"],
    ["height", "cy"],
  ].every(([side, key]) => Math.abs(left[side] - right[key]) <= tolerance)
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
    let register = {
      ...document.openRegister("", ""),
      index: { format: 2, total: elements.length, slides, elements, pages: [] },
    }
    const padding = { left: 10 * point, top: 10 * point, right: 10 * point, bottom: 10 * point }
    register = wrapped(document, register, slide, [node(4)], node(20), node(21))
    register = landed(document, register, node(20), { layout: { padding: { set: padding } } })
    register = landed(document, register, node(21), { fills: { p0: { set: { solid: { rgb: "DDEBF7" } } } } })
    register = wrapped(document, register, slide, [node(20), node(5)], node(22), node(23))
    register = landed(document, register, node(22), { layout: { gap: { set: 20 * point }, align: { set: "center" } } })
    const inner = document.readLayout(register, node(20))
    const outer = document.readLayout(register, node(22))
    if (inner === null || outer === null) throw new Error("frame nested has no layout")
    for (const child of [...inner.children, ...outer.children]) wanted.set(Number(child.node.split(".")[1]), child.box)
    wanted.set(21, inner.box)
    wanted.set(23, outer.box)
    frames.set(node(20), { flow: inner.flow, children: inner.children.map((child) => child.node) })
    frames.set(node(22), { flow: outer.flow, children: outer.children.map((child) => child.node) })
    return [{ name: written, original, parts: pptx.exportParts(pptx.orderedParts(deck, register), register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || wanted.size === 0) return ["frame nested not written"]
    const part = pptx.readSlides(before)[0]?.part
    const touched = [part, "[Content_Types].xml", "ppt/slides/_rels/slide1.xml.rels"]
    const kept = [...before.keys()].filter((name) => !touched.includes(name))
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "frame nested"),
    )
    const now = new Map(
      pptx
        .paintReader(after)
        .slide(part)
        .elements.map((row) => [Number(row.shape), row.box]),
    )
    for (const [shape, box] of wanted)
      if (!near(now.get(shape), box)) lines.push(`frame nested shape ${shape} does not paint where the frames lay it`)
    const reread = new Map(pptx.indexPackage(after).elements.map((element) => [element.node, element.framing]))
    for (const [frame, { flow, children }] of frames) {
      const framing = reread.get(frame)
      const same =
        framing !== undefined &&
        framing.layout.flow === flow &&
        framing.children.length === children.length &&
        framing.children.every((child, at) => child === children[at])
      if (!same) lines.push(`frame nested ${frame} does not read back as the same auto layout frame`)
    }
    return lines
  },
}
