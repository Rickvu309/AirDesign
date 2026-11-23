import fs from "node:fs"
import path from "node:path"
import { slideExportLines } from "./slide-export.mjs"
import { packageBuild } from "./package-build.mjs"

export const cloneEditsName = "exported-clone-edits.pptx"
export const cloneEditsOriginalName = "census-updating-spm.pptx"

export const cloneSources = [
  { part: "ppt/slides/slide5.xml", shape: "34", text: "Timeline on the copy" },
  { part: "ppt/slides/slide7.xml", shape: "33", text: "Pictures on the copy" },
  { part: "ppt/slides/slide19.xml", shape: "4", text: "Charts on the copy" },
]

const listedParts = new Set(["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"])
const ownedKinds = new Set([
  "notesSlide",
  "chart",
  "diagramData",
  "diagramLayout",
  "diagramQuickStyle",
  "diagramColors",
  "diagramDrawing",
])

const sameBytes = (left, right) =>
  left !== undefined && right !== undefined && Buffer.from(left).equals(Buffer.from(right))

const relsOf = (part) => part.replace(/([^/]+)$/, "_rels/$1.rels")

const partOf = (source, target) => {
  const folder = source.split("/").slice(0, -1)
  for (const segment of target.split("/")) {
    if (segment === "..") folder.pop()
    else if (segment !== ".") folder.push(segment)
  }
  return folder.join("/")
}

export const links = (parts, part) => {
  const bytes = parts.get(relsOf(part))
  if (bytes === undefined) return []
  return [...new TextDecoder().decode(bytes).matchAll(/<Relationship [^>]*\/>/g)].flatMap(([element]) => {
    const id = / Id="([^"]*)"/.exec(element)?.[1]
    const kind = / Type="[^"]*\/([^"/]+)"/.exec(element)?.[1]
    const target = / Target="([^"]*)"/.exec(element)?.[1]
    if (id === undefined || kind === undefined || target === undefined || element.includes('TargetMode="External"'))
      return []
    return [{ id, kind, part: partOf(part, target) }]
  })
}

export const clonedParts = (pptx, document, parts) => {
  const slides = pptx.readSlides(parts)
  const file = slides.map((row) => document.readSlideId(row.slide))
  const order = []
  for (const source of cloneSources) {
    const slide = document.readSlideId(slides.find((row) => row.part === source.part)?.slide)
    const id = document.nextSlideId([...file, ...order.map((command) => command.id)])
    const key = document.orderKeyAfter(document.presentSlides({ file, order }), slide)
    order.push({ slide: "clone", id, source: slide, key })
  }
  let next = pptx.orderedParts(parts, { file, order })
  const placed = pptx.readSlides(next).map((row) => row.part)
  const copies = cloneSources.map((source) => placed[placed.indexOf(source.part) + 1])
  cloneSources.forEach((source, index) => {
    const part = copies[index]
    const value = pptx.oneRunValue(next, part, source.shape, source.text)
    next = pptx.applyRoute(next, { name: "text", part, shape: source.shape, value })
  })
  return next
}

export const writeCloneEdits = async ({ pptx, root, parts, directory }) => {
  const document = await packageBuild(root, "@airdesign/document")
  const originalFile = path.join(root, "scripts/pptx-fixtures", cloneEditsOriginalName)
  const packed = await pptx.exportPackage(
    fs.readFileSync(originalFile),
    clonedParts(pptx, document, parts.get(cloneEditsOriginalName)),
  )
  const file = path.join(directory, cloneEditsName)
  fs.writeFileSync(file, packed)
  parts.set(cloneEditsName, await pptx.readParts(packed))
  return file
}

const words = (shape) => shape.text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")

export const cloneEditsLines = ({ pptx, parts, lists, ids, orders }) => {
  const before = parts.get(cloneEditsOriginalName)
  const after = parts.get(cloneEditsName)
  if (before === undefined || after === undefined) return ["clone edits export missing"]
  const lines = slideExportLines({
    pptx,
    parts,
    lists,
    ids,
    orders,
    kept: [...before.keys()].filter((name) => !listedParts.has(name)),
    original: cloneEditsOriginalName,
    exported: cloneEditsName,
  }).map((line) => line.replace(/^slide export/, "clone edits"))
  const placed = pptx.readSlides(after).map((row) => row.part)
  for (const source of cloneSources) {
    const copy = placed[placed.indexOf(source.part) + 1]
    if (copy === undefined || before.has(copy)) {
      lines.push(`clone edits no copy after ${source.part}`)
      continue
    }
    const shape = pptx.readShapes(after).find((row) => row.part === copy && row.shape === source.shape)
    if (shape === undefined || words(shape) !== source.text) lines.push(`clone edits ${copy} text not typed`)
    const copied = new Map(links(after, copy).map((link) => [link.id, link]))
    for (const link of links(before, source.part)) {
      const twin = copied.get(link.id)
      if (twin === undefined || twin.kind !== link.kind) {
        lines.push(`clone edits ${copy} lost ${link.id}`)
        continue
      }
      const owned = ownedKinds.has(link.kind)
      if (owned && (before.has(twin.part) || !sameBytes(after.get(twin.part), before.get(link.part)))) {
        lines.push(`clone edits ${copy} ${link.kind} is not its own copy of ${link.part}`)
      }
      const back = links(after, twin.part).filter((row) => row.kind === "slide")
      if (link.kind === "notesSlide" && (back.length !== 1 || back[0].part !== copy)) {
        lines.push(`clone edits ${twin.part} does not point back at ${copy}`)
      }
      if (!owned && twin.part !== link.part) lines.push(`clone edits ${copy} ${link.kind} moved off ${link.part}`)
    }
  }
  return lines
}
