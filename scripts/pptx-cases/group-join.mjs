import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const written = "written-group-join.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()
const tolerance = 2

const drags = [
  { node: "2799.28", into: "2799.11" },
  { node: "2799.13", into: null },
  { node: "2799.3", into: null },
]
const emptied = "2799.7"

const wanted = new Map()

function ran(document, register, commands) {
  let current = register
  for (const command of commands) {
    const node = command.command === "person" ? command.node : undefined
    if (node !== undefined && !current.nodes.includes(node)) {
      const opened = document.decide(current, { command: "add", node, floor: "", route: "" })
      if (opened.decision !== "apply") throw new Error(`group join ${node} ${opened.code}`)
      current = opened.register
    }
    const decision = document.decide(current, command)
    if (decision.decision !== "apply") throw new Error(`group join ${decision.code}`)
    current = decision.register
  }
  return current
}

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
  if (left === null || left === undefined || right === null || right === undefined) return left === right
  const sides = ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - right[side]) <= tolerance)
  return sides && Math.abs(left.rotation - right.rotation) < 0.01 && left.flipH === right.flipH
}

function bounds(boxes) {
  const corners = boxes.flatMap((box) => {
    const radians = (box.rotation * Math.PI) / 180
    const halfX = (Math.abs(box.width * Math.cos(radians)) + Math.abs(box.height * Math.sin(radians))) / 2
    const halfY = (Math.abs(box.width * Math.sin(radians)) + Math.abs(box.height * Math.cos(radians))) / 2
    const [middleX, middleY] = [box.x + box.width / 2, box.y + box.height / 2]
    return [
      [middleX - halfX, middleY - halfY],
      [middleX + halfX, middleY + halfY],
    ]
  })
  const left = Math.min(...corners.map(([x]) => x))
  const top = Math.min(...corners.map(([, y]) => y))
  const right = Math.max(...corners.map(([x]) => x))
  const bottom = Math.max(...corners.map(([, y]) => y))
  return { x: left, y: top, width: right - left, height: bottom - top, rotation: 0, flipH: false }
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
    for (const drag of drags) {
      const changed = document.changeLayout(register, { move: drag.node, frame: drag.into, before: null, file })
      if (changed === null || !("turn" in changed)) throw new Error(`group join ${drag.node} is refused`)
      register = ran(document, register, changed.turn)
    }
    const parents = new Map(drags.map((drag) => [drag.node, drag.into]))
    const groups = new Set(
      elements
        .filter((element) => element.kind === "group" && document.groupFormed(register, element.node))
        .map((element) => element.node),
    )
    wanted.set("tree", { elements, parents, groups, register: document, after: register })
    return [{ name: written, original, parts: pptx.exportParts(pptx.orderedParts(deck, register), register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || !wanted.has("tree")) return ["group join not written"]
    const { elements, parents, groups, register: document, after: register } = wanted.get("tree")
    const slideParts = new Map(pptx.readSlides(before).map((row) => [row.slide, row.part]))
    const part = slideParts.get("2799")
    const kept = [...before.keys()].filter((name) => name !== part)
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "group join"),
    )
    const shown = painted(pptx, before, part)
    const now = painted(pptx, after, part)
    const [oldXml, newXml] = [decoder.decode(before.get(part)), decoder.decode(after.get(part))]
    if (newXml.includes(`<p:cNvPr id="${emptied.split(".")[1]}"`))
      lines.push(`group join left the emptied group ${emptied} in the file`)
    const parentOf = (node) =>
      parents.has(node) ? parents.get(node) : (elements.find((each) => each.node === node)?.group ?? null)
    for (const element of elements.filter((each) => each.node.startsWith("2799."))) {
      const shape = element.node.split(".")[1]
      if (element.node === emptied) continue
      if (groups.has(element.node)) {
        const children = elements
          .filter((each) => parentOf(each.node) === element.node && document.elementGone(register, each.node) === false)
          .map((each) => now.get(each.node.split(".")[1])?.box)
          .filter((box) => box !== undefined)
        if (!near(now.get(shape)?.box, bounds(children)))
          lines.push(`group join ${element.node} does not fit its layers`)
        continue
      }
      if (!near(now.get(shape)?.box, shown.get(shape)?.box)) lines.push(`group join moved ${element.node} on the slide`)
      if (!parents.has(element.node) && xfrmOf(newXml, shape) !== xfrmOf(oldXml, shape))
        lines.push(`group join rewrote ${element.node}`)
    }
    return lines
  },
}
