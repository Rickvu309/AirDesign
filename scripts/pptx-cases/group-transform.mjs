import { fileURLToPath, pathToFileURL } from "node:url"
import { slideExportLines } from "../slide-export.mjs"

const original = "doe-heat-pumps.pptx"
const written = "written-group-transform.pptx"
const documentBuild = pathToFileURL(fileURLToPath(new URL("../../packages/document/dist/index.js", import.meta.url)))
const decoder = new TextDecoder()
const inch = 914_400
const tolerance = 2

const changes = [
  { node: "2799.9", box: (shown) => ({ x: shown.x + inch / 2 }) },
  { node: "2799.12", box: (shown) => ({ y: shown.y - inch / 4, w: shown.cx * 2 }) },
  { node: "2799.3", box: () => ({ rot: 1_800_000 }) },
]

const wanted = new Map()

function landed(document, register, node, patch) {
  let current = register
  if (!current.nodes.includes(node)) {
    const opened = document.decide(current, { command: "add", node, floor: "", route: "" })
    if (opened.decision !== "apply") throw new Error(`group transform ${node} ${opened.code}`)
    current = opened.register
  }
  const decision = document.decide(current, { command: "person", node, v: document.format, patch })
  if (decision.decision !== "apply") throw new Error(`group transform ${node} ${decision.code}`)
  return decision.register
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
  covers: ["box.x", "box.y", "box.w", "box.rot"],
  written: [written],
  async write({ pptx, parts }) {
    const document = await import(documentBuild.href)
    const deck = parts.get(original)
    const { slides, elements } = pptx.indexPackage(deck)
    let register = {
      ...document.openRegister("", ""),
      index: { format: 2, total: elements.length, slides, elements, pages: [] },
    }
    for (const change of changes) {
      const shown = document.shownPlace(register, change.node)
      if (shown === null) throw new Error(`group transform ${change.node} has no place on the slide`)
      const plan = document.planChange(
        { target: { node: change.node }, box: change.box(shown.box) },
        document.registerScope(register),
      )
      if (!plan.ok) throw new Error(`group transform ${change.node} ${plan.refusals[0]?.code}`)
      for (const { node, row } of plan.rows) register = landed(document, register, node, row.patch)
      const place = document.shownPlace(register, change.node)
      wanted.set(change.node, place)
    }
    const above = (node) => {
      const parent = elements.find((each) => each.node === node)?.group
      return parent === undefined ? [] : [parent, ...above(parent)]
    }
    const groups = new Set(changes.flatMap((change) => above(change.node)))
    wanted.set("groups", { groups, elements })
    return [{ name: written, original, parts: pptx.exportParts(deck, register) }]
  },
  lines(answers) {
    const { pptx, parts } = answers
    const before = parts.get(original)
    const after = parts.get(written)
    if (before === undefined || after === undefined || !wanted.has("groups")) return ["group transform not written"]
    const { groups, elements } = wanted.get("groups")
    const slideParts = new Map(pptx.readSlides(before).map((row) => [row.slide, row.part]))
    const changedParts = new Set(changes.map((change) => slideParts.get(change.node.split(".")[0])))
    const kept = [...before.keys()].filter((name) => !changedParts.has(name))
    const lines = slideExportLines({ ...answers, original, exported: written, kept }).map((line) =>
      line.replace(/^slide export/, "group transform"),
    )
    const moved = new Set(changes.map((change) => change.node))
    for (const part of changedParts) {
      const slide = [...slideParts].find(([, each]) => each === part)?.[0]
      const shown = painted(pptx, before, part)
      const now = painted(pptx, after, part)
      const [oldXml, newXml] = [decoder.decode(before.get(part)), decoder.decode(after.get(part))]
      for (const element of elements.filter((each) => each.node.startsWith(`${slide}.`))) {
        const shape = element.node.split(".")[1]
        if (moved.has(element.node)) {
          const place = wanted.get(element.node)
          const box = { x: place.box.x, y: place.box.y, width: place.box.cx, height: place.box.cy }
          const target = { ...box, rotation: place.rot / 60_000, flipH: place.flipH }
          if (!near(now.get(shape)?.box, target))
            lines.push(`group transform ${element.node} did not land where it was put`)
          continue
        }
        if (groups.has(element.node)) {
          const children = elements.filter((each) => each.group === element.node).map((each) => each.node.split(".")[1])
          const fitted = bounds(children.map((child) => now.get(child)?.box).filter((box) => box !== undefined))
          if (!near(now.get(shape)?.box, fitted)) lines.push(`group transform ${element.node} does not fit its layers`)
          continue
        }
        if (!near(now.get(shape)?.box, shown.get(shape)?.box)) lines.push(`group transform moved ${element.node}`)
        if (xfrmOf(newXml, shape) !== xfrmOf(oldXml, shape)) lines.push(`group transform rewrote ${element.node}`)
      }
    }
    return lines
  },
}
