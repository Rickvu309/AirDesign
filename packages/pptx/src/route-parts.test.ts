import { routeHosts as hosts } from "./route-hosts.js"
import { commonPrefix } from "./byte-prefix.js"
import { beforeAll, describe, expect, it } from "vitest"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, encodeUtf8 as text } from "./package-bytes.js"
import { readParts } from "./package-container.js"
import { partTouch, routeOperations, routeRuns, touchMatches, type RouteRun } from "./route-parts.js"
import { danglingShapeReferences, newDanglingShapeReferences } from "./shape-id.js"
import { applyRoute, type SlideRoute } from "./slide-route.js"
import { shapeById } from "./shape-tree.js"
import { applyStructuralRoute, type StructuralEdit } from "./structural-route.js"
import { markupChildren, shapeTextValue, shownText, type MarkupChildren } from "./text-value-route.js"

declare const process: {
  cwd(): string
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string): Uint8Array
    readdirSync(path: string): string[]
    statSync(path: string): { size: number }
  }
}

const fs = process.getBuiltinModule("node:fs")

function sameBytes(left: Uint8Array | undefined, right: Uint8Array | undefined): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.length === right.length && left.every((byte, index) => byte === right[index])
}

type Parts = ReadonlyMap<string, Uint8Array>
type Edit = SlideRoute | StructuralEdit
type Deck = { readonly parts: Parts; readonly runs: readonly RouteRun[] }

const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"
const contentTypesPart = "[Content_Types].xml"
const firstSlidePart = "ppt/slides/slide1.xml"
const markedText = "R&D <x> &amp;"
const emptyBytes = new Uint8Array()
const shapeKinds = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const inlineKinds = new Set(["a:r", "a:br", "a:fld"])

let decks: readonly Deck[] = []

beforeAll(async () => {
  const root = `${process.cwd()}/scripts/pptx-fixtures`
  const names = fs
    .readdirSync(root)
    .filter((name) => name.endsWith(".pptx") && fs.statSync(`${root}/${name}`).size >= 100_000)
  expect(names.sort()).toEqual(["census-updating-spm.pptx", "doe-heat-pumps.pptx", "nasa-1d-cnn.pptx"])
  const loaded: Deck[] = []
  for (const name of names) {
    const parts = await readParts(fs.readFileSync(`${root}/${name}`))
    loaded.push({ parts, runs: routeRuns(parts) })
  }
  decks = loaded
}, 30_000)

function runOf(deck: Deck, operation: RouteRun["operation"]): RouteRun {
  const run = deck.runs.find((item) => item.operation === operation)
  if (run === undefined) throw new Error(operation)
  return run
}

function isProbe(run: { readonly text: string }): boolean {
  return run.text.startsWith("AirDesignProbe")
}

function escaped(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function partOf(parts: Parts, name: string): Uint8Array {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error(name)
  return bytes
}

function markup(bytes: Uint8Array): readonly MarkupElement[] {
  const document = markupDocument(bytes)
  expect(document.wellFormed).toBe(true)
  return document.elements
}

function expectBytes(actual: Uint8Array, expected: Uint8Array) {
  const at = commonPrefix(actual, expected)
  const difference =
    at === actual.length && at === expected.length
      ? null
      : {
          at,
          actual: decodeUtf8(actual.subarray(at, at + 80)),
          expected: decodeUtf8(expected.subarray(at, at + 80)),
        }
  expect(difference).toBeNull()
}

function cutOut(bytes: Uint8Array, element: MarkupElement): Uint8Array {
  return spliceBytes(bytes, [{ start: element.start, end: element.end, next: emptyBytes }])
}

function insertedAt(bytes: Uint8Array, at: number, xml: Uint8Array): Uint8Array {
  return spliceBytes(bytes, [{ start: at, end: at, next: xml }])
}

function movedBefore(bytes: Uint8Array, moving: MarkupElement, target: MarkupElement): Uint8Array {
  return spliceBytes(bytes, [
    { start: moving.start, end: moving.end, next: emptyBytes },
    { start: target.start, end: target.start, next: bytes.slice(moving.start, moving.end) },
  ])
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(name)
  return value
}

function childrenOf(children: MarkupChildren, parent: MarkupElement): readonly MarkupElement[] {
  return children[parent.index] ?? []
}

function childOf(children: MarkupChildren, parent: MarkupElement, kind: string): MarkupElement | undefined {
  return childrenOf(children, parent).find((element) => element.kind === kind)
}

function named(elements: readonly MarkupElement[], kind: string, id: string): MarkupElement {
  return required(
    elements.find((element) => element.kind === kind && element.id === id),
    kind,
  )
}

function attribute(element: MarkupElement, name: string): string {
  return required(element.attributes.find((item) => item.name === name)?.value, name)
}

function shapeIds(elements: readonly MarkupElement[]): (string | null)[] {
  return elements.filter((element) => element.kind === "p:cNvPr").map((element) => element.id)
}

function slideIds(parts: Parts): string[] {
  return markup(partOf(parts, presentationPart))
    .filter((element) => element.kind === "p:sldId")
    .map((element) => required(element.id ?? undefined, "p:sldId"))
}

function slideParts(parts: Parts): string[] {
  return [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
}

function topShapes(elements: readonly MarkupElement[], children: MarkupChildren): readonly MarkupElement[] {
  const tree = required(
    elements.find((element) => element.kind === "p:spTree"),
    "p:spTree",
  )
  return childrenOf(children, tree).filter((element) => shapeKinds.has(element.kind))
}

function idOf(children: MarkupChildren, shape: MarkupElement): string {
  const properties = required(childrenOf(children, shape)[0], "properties")
  return required(childOf(children, properties, "p:cNvPr")?.id ?? undefined, "p:cNvPr")
}

function frameOf(
  children: MarkupChildren,
  shape: MarkupElement,
): { readonly holder: MarkupElement; readonly frame: MarkupElement | undefined } {
  const holder = required(
    childrenOf(children, shape).find((element) => ["p:spPr", "p:grpSpPr", "p:xfrm"].includes(element.kind)),
    "p:spPr",
  )
  return { holder, frame: holder.kind === "p:xfrm" ? holder : childOf(children, holder, "a:xfrm") }
}

function ownBox(
  parts: Parts,
  kind: "a:off" | "a:ext",
): { readonly part: string; readonly shape: string; readonly first: number; readonly second: number } {
  const names = kind === "a:off" ? (["x", "y"] as const) : (["cx", "cy"] as const)
  for (const part of slideParts(parts)) {
    const elements = markup(partOf(parts, part))
    const children = markupChildren(elements)
    for (const shape of topShapes(elements, children)) {
      const { frame } = frameOf(children, shape)
      const own = frame === undefined ? undefined : childOf(children, frame, kind)
      if (own === undefined) continue
      return {
        part,
        shape: idOf(children, shape),
        first: Number(attribute(own, names[0])),
        second: Number(attribute(own, names[1])),
      }
    }
  }
  throw new Error(kind)
}

function boxBytes(old: Uint8Array, shapeId: string, kind: "a:off" | "a:ext", asked: Record<string, number>) {
  const elements = markup(old)
  const children = markupChildren(elements)
  const { holder, frame } = frameOf(children, shapeById(elements, shapeId))
  const own = frame === undefined ? undefined : childOf(children, frame, kind)
  if (own !== undefined) {
    const edits: ByteEdit[] = Object.entries(asked).map(([name, number]) => {
      const attribute = required(
        own.attributes.find((item) => item.name === name),
        name,
      )
      return { start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(String(number)) }
    })
    return spliceBytes(old, edits)
  }
  const fields = Object.entries(asked)
    .map(([name, number]) => `${name}="${number}"`)
    .join(" ")
  const xml = `<${kind} ${fields}/>`
  if (frame !== undefined) {
    const off = childOf(children, frame, "a:off")
    return insertedAt(old, kind === "a:ext" && off !== undefined ? off.end : frame.openEnd, encodeUtf8(xml))
  }
  if (holder.selfClosing) {
    return spliceBytes(old, [
      { start: holder.start, end: holder.end, next: encodeUtf8(`<p:spPr><a:xfrm>${xml}</a:xfrm></p:spPr>`) },
    ])
  }
  return insertedAt(old, holder.openEnd, encodeUtf8(`<a:xfrm>${xml}</a:xfrm>`))
}

function expectText(before: Parts, after: Parts, edit: Extract<Edit, { readonly name: "text" }>) {
  const old = partOf(before, edit.part)
  const next = partOf(after, edit.part)
  const elements = markup(old)
  const children = markupChildren(elements)
  const shape = shapeById(elements, edit.shape)
  const current = shapeTextValue(children, old, shape)
  const body = required(childOf(children, shape, "p:txBody"), "p:txBody")
  const paragraphs = childrenOf(children, body).filter((element) => element.kind === "a:p")
  const edits: ByteEdit[] = []
  for (const [at, paragraph] of edit.value.entries()) {
    for (const [index, run] of paragraph.runs.entries()) {
      if (run.text === current[at]?.runs[index]?.text) continue
      const inlines = childrenOf(children, required(paragraphs[at], "a:p")).filter((element) =>
        inlineKinds.has(element.kind),
      )
      const holder = required(childOf(children, required(inlines[index], "a:r"), "a:t"), "a:t")
      edits.push({ start: holder.openEnd, end: holder.closeStart, next: encodeUtf8(escaped(run.text)) })
    }
  }
  expect(edits).toHaveLength(1)
  expectBytes(next, spliceBytes(old, edits))
  const read = markup(next)
  expect(shapeTextValue(markupChildren(read), next, shapeById(read, edit.shape))).toEqual(edit.value)
}

function expectAppendedShape(old: Uint8Array, next: Uint8Array, kind: string) {
  const elements = markup(next)
  const children = markupChildren(elements)
  const tree = required(
    elements.find((element) => element.kind === "p:spTree"),
    "p:spTree",
  )
  const added = required(childrenOf(children, tree).at(-1), "shape")
  expect(added.kind).toBe(kind)
  expect(added.end).toBe(tree.closeStart)
  expectBytes(cutOut(next, added), old)
  expect(shapeIds(markup(old))).not.toContain(idOf(children, added))
  return { elements, children, added }
}

function expectAddedText(before: Parts, after: Parts, edit: Extract<Edit, { readonly name: "spTree.add" }>) {
  const next = partOf(after, edit.part)
  const { elements, children, added } = expectAppendedShape(partOf(before, edit.part), next, "p:sp")
  expect(shownText(shapeTextValue(children, next, added))).toBe(edit.text)
  const holder = required(
    elements.find((element) => element.kind === "a:t" && element.start > added.start && element.end < added.end),
    "a:t",
  )
  expect(decodeUtf8(next.subarray(holder.openEnd, holder.closeStart))).toBe(escaped(edit.text))
  const { frame } = frameOf(children, added)
  const off = required(childOf(children, required(frame, "a:xfrm"), "a:off"), "a:off")
  const ext = required(childOf(children, required(frame, "a:xfrm"), "a:ext"), "a:ext")
  expect([attribute(off, "x"), attribute(off, "y"), attribute(ext, "cx"), attribute(ext, "cy")]).toEqual(
    [edit.x, edit.y, edit.cx, edit.cy].map(String),
  )
}

function expectClone(old: Uint8Array, next: Uint8Array, shapeId: string) {
  const elements = markup(old)
  const found = shapeById(elements, shapeId)
  const end = found.end + next.length - old.length
  expectBytes(spliceBytes(next, [{ start: found.end, end, next: emptyBytes }]), old)
  const piece = next.slice(found.end, end)
  const source = old.slice(found.start, found.end)
  const marks = markup(piece).filter((element) => element.kind === "p:cNvPr")
  const sourceMarks = markup(source).filter((element) => element.kind === "p:cNvPr")
  expect(marks).toHaveLength(sourceMarks.length)
  const restored: ByteEdit[] = marks.map((mark, index) => {
    const id = required(
      mark.attributes.find((item) => item.name === "id"),
      "id",
    )
    return {
      start: id.valueStart,
      end: id.valueEnd,
      next: encodeUtf8(required(sourceMarks[index]?.id ?? undefined, "p:cNvPr")),
    }
  })
  expectBytes(spliceBytes(piece, restored), source)
  const used = new Set(shapeIds(elements))
  const fresh = marks.map((mark) => mark.id)
  expect(new Set(fresh).size).toBe(fresh.length)
  expect(fresh.filter((id) => used.has(id))).toEqual([])
}

function expectSlideAdded(before: Parts, after: Parts, sourceId: string, copy: boolean) {
  const oldPresentation = partOf(before, presentationPart)
  const nextPresentation = partOf(after, presentationPart)
  const elements = markup(oldPresentation)
  const source = named(elements, "p:sldId", sourceId)
  const end = source.end + nextPresentation.length - oldPresentation.length
  expectBytes(spliceBytes(nextPresentation, [{ start: source.end, end, next: emptyBytes }]), oldPresentation)
  const piece = markup(nextPresentation.slice(source.end, end))
  expect(piece.map((element) => element.kind)).toEqual(["p:sldId"])
  const slide = required(piece[0], "p:sldId")
  expect(elements.some((element) => element.kind === "p:sldId" && element.id === slide.id)).toBe(false)
  const oldRels = partOf(before, presentationRels)
  const nextRels = partOf(after, presentationRels)
  const relationship = required(
    markup(nextRels)
      .filter((element) => element.kind === "Relationship")
      .at(-1),
    "Relationship",
  )
  expect(attribute(relationship, "Id")).toBe(attribute(slide, "r:id"))
  expectBytes(cutOut(nextRels, relationship), oldRels)
  const part = `ppt/${attribute(relationship, "Target")}`
  expect(before.has(part)).toBe(false)
  expectTypes(after, before, `/${part}`)
  const written = partOf(after, part)
  if (copy) expectBytes(written, partOf(before, targetOf(before, source)))
  else expect(topShapes(markup(written), markupChildren(markup(written)))).toEqual([])
}

function relationshipOf(parts: Parts, slide: MarkupElement): MarkupElement {
  const id = attribute(slide, "r:id")
  return required(
    markup(partOf(parts, presentationRels)).find(
      (element) => element.kind === "Relationship" && attribute(element, "Id") === id,
    ),
    "Relationship",
  )
}

function targetOf(parts: Parts, slide: MarkupElement): string {
  return `ppt/${attribute(relationshipOf(parts, slide), "Target")}`
}

function expectSlideRemoved(before: Parts, after: Parts, slideId: string) {
  const oldPresentation = partOf(before, presentationPart)
  const slide = named(markup(oldPresentation), "p:sldId", slideId)
  expectBytes(partOf(after, presentationPart), cutOut(oldPresentation, slide))
  expectBytes(partOf(after, presentationRels), cutOut(partOf(before, presentationRels), relationshipOf(before, slide)))
  expectTypes(before, after, `/${targetOf(before, slide)}`)
}

function expectTypes(larger: Parts, smaller: Parts, slide: string) {
  const types = partOf(larger, contentTypesPart)
  const only = markup(types).filter(
    (item) => item.kind === "Override" && !smaller.has(attribute(item, "PartName").slice(1)),
  )
  expect(only[0] === undefined ? null : attribute(only[0], "PartName")).toBe(slide)
  const cut = only.map((item) => ({ start: item.start, end: item.end, next: emptyBytes }))
  expectBytes(spliceBytes(types, cut), partOf(smaller, contentTypesPart))
}

function expectOnlyWrapped(larger: Uint8Array, smaller: Uint8Array, element: MarkupElement) {
  const elements = markup(larger)
  let current: MarkupElement | undefined = element
  while (current !== undefined) {
    if (sameBytes(cutOut(larger, current), smaller)) break
    current = elements[current.parent]
  }
  expect(current).toBeDefined()
}

function sectionByTitle(elements: readonly MarkupElement[], old: readonly MarkupElement[], title: string) {
  return required(
    elements.find(
      (element) =>
        element.kind === "p14:section" &&
        attribute(element, "name") === title &&
        !old.some((item) => item.kind === "p14:section" && item.id === element.id),
    ),
    "p14:section",
  )
}

function sectionIds(bytes: Uint8Array): (string | null)[] {
  return markup(bytes)
    .filter((element) => element.kind === "p14:section")
    .map((element) => element.id)
}

function expectInside(before: Parts, after: Parts, edit: Edit) {
  const oldSlide = "part" in edit ? partOf(before, edit.part) : emptyBytes
  const nextSlide = "part" in edit ? partOf(after, edit.part) : emptyBytes
  const oldPresentation = partOf(before, presentationPart)
  const nextPresentation = partOf(after, presentationPart)
  switch (edit.name) {
    case "spPr.fill": {
      const oldElements = markup(oldSlide)
      const nextElements = markup(nextSlide)
      const oldShape = shapeById(oldElements, edit.shape)
      const nextShape = shapeById(nextElements, edit.shape)
      const oldPr = required(
        oldElements.find((item) => item.parent === oldShape.index && item.kind === "p:spPr"),
        "p:spPr",
      )
      const nextPr = required(
        nextElements.find((item) => item.parent === nextShape.index && item.kind === "p:spPr"),
        "p:spPr",
      )
      expectBytes(cutOut(nextSlide, nextPr), cutOut(oldSlide, oldPr))
      const fill = required(
        nextElements.find((item) => item.parent === nextPr.index && item.kind === "a:solidFill"),
        "a:solidFill",
      )
      expect(decodeUtf8(nextSlide.subarray(fill.start, fill.end))).toBe(
        '<a:solidFill><a:srgbClr val="19A7E8"/></a:solidFill>',
      )
      return
    }
    case "text":
      expectText(before, after, edit)
      return
    case "move":
      expectBytes(nextSlide, boxBytes(oldSlide, edit.shape, "a:off", { x: edit.x, y: edit.y }))
      return
    case "resize":
      expectBytes(nextSlide, boxBytes(oldSlide, edit.shape, "a:ext", { cx: edit.cx, cy: edit.cy }))
      return
    case "spTree.add":
      expectAddedText(before, after, edit)
      return
    case "spTree.remove":
      expectBytes(nextSlide, cutOut(oldSlide, shapeById(markup(oldSlide), edit.shape)))
      return
    case "spTree.order": {
      const elements = markup(oldSlide)
      expectBytes(nextSlide, movedBefore(oldSlide, shapeById(elements, edit.shape), shapeById(elements, edit.before)))
      return
    }
    case "spTree.clone":
      expectClone(oldSlide, nextSlide, edit.shape)
      return
    case "graphicFrame.addTable":
      expectAppendedShape(oldSlide, nextSlide, "p:graphicFrame")
      return
    case "tbl.addRow": {
      const row = required(markup(oldSlide).filter((element) => element.kind === "a:tr")[edit.row - 1], "a:tr")
      expectBytes(nextSlide, insertedAt(oldSlide, row.end, oldSlide.slice(row.start, row.end)))
      return
    }
    case "tbl.removeRow": {
      const row = required(markup(oldSlide).filter((element) => element.kind === "a:tr")[edit.row - 1], "a:tr")
      expectBytes(nextSlide, cutOut(oldSlide, row))
      return
    }
    case "tbl.orderRow": {
      const rows = markup(oldSlide).filter((element) => element.kind === "a:tr")
      expectBytes(
        nextSlide,
        movedBefore(oldSlide, required(rows[edit.row - 1], "a:tr"), required(rows[edit.before - 1], "a:tr")),
      )
      return
    }
    case "sldIdLst.add":
      expectSlideAdded(before, after, edit.after, false)
      return
    case "sldIdLst.clone":
      expectSlideAdded(before, after, edit.slide, true)
      return
    case "sldIdLst.remove":
      expectSlideRemoved(before, after, edit.slide)
      return
    case "sldIdLst.order": {
      const elements = markup(oldPresentation)
      expectBytes(
        nextPresentation,
        movedBefore(oldPresentation, named(elements, "p:sldId", edit.slide), named(elements, "p:sldId", edit.before)),
      )
      return
    }
    case "sectionLst.add":
      expectOnlyWrapped(
        nextPresentation,
        oldPresentation,
        sectionByTitle(markup(nextPresentation), markup(oldPresentation), edit.title),
      )
      return
    case "sectionLst.remove":
      expectOnlyWrapped(oldPresentation, nextPresentation, named(markup(oldPresentation), "p14:section", edit.section))
      expect(sectionIds(nextPresentation)).toEqual(sectionIds(oldPresentation).filter((id) => id !== edit.section))
      return
    case "sectionLst.order": {
      const elements = markup(oldPresentation)
      expectBytes(
        nextPresentation,
        movedBefore(
          oldPresentation,
          named(elements, "p14:section", edit.section),
          named(elements, "p14:section", edit.before),
        ),
      )
      return
    }
    default:
      throw new Error(edit.name)
  }
}

function forwardOrders(parts: Parts): { readonly base: Parts; readonly edit: StructuralEdit }[] {
  const orders: { base: Parts; edit: StructuralEdit }[] = []
  const slides = slideIds(parts)
  orders.push({
    base: parts,
    edit: { name: "sldIdLst.order", slide: required(slides[0], "slide"), before: required(slides[2], "slide") },
  })
  let sectioned = parts
  for (const title of ["First", "Second", "Third"]) {
    sectioned = applyStructuralRoute(sectioned, { name: "sectionLst.add", title })
  }
  const sections = markup(partOf(sectioned, presentationPart)).filter((element) => element.kind === "p14:section")
  orders.push({
    base: sectioned,
    edit: {
      name: "sectionLst.order",
      section: required(sections[0]?.id ?? undefined, "section"),
      before: required(sections[2]?.id ?? undefined, "section"),
    },
  })
  let shapes = false
  let table = false
  for (const part of slideParts(parts)) {
    const elements = markup(partOf(parts, part))
    const children = markupChildren(elements)
    const top = topShapes(elements, children)
    const first = top[0]
    const third = top[2]
    if (!shapes && first !== undefined && third !== undefined) {
      shapes = true
      orders.push({
        base: parts,
        edit: { name: "spTree.order", part, shape: idOf(children, first), before: idOf(children, third) },
      })
    }
    const rows = elements.filter((element) => element.kind === "a:tr")
    const tall = elements.find(
      (element) =>
        element.kind === "a:tbl" && childrenOf(children, element).filter((row) => row.kind === "a:tr").length >= 3,
    )
    if (table || tall === undefined) continue
    table = true
    const row = rows.findIndex((item) => item.parent === tall.index) + 1
    orders.push({ base: parts, edit: { name: "tbl.orderRow", part, row, before: row + 2 } })
  }
  return orders
}

describe("partTouch", () => {
  it("says a text edit changes only that slide", () => {
    expect(
      partTouch(hosts(), {
        name: "text",
        part: "ppt/slides/slide1.xml",
        shape: "2",
        value: [{ from: 0, runs: [{ from: 0, text: "AirDesignProbe" }] }],
      }),
    ).toEqual({ changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })
  })

  it("names the next slide file from the highest number, including a gap", () => {
    expect(partTouch(hosts(), { name: "sldIdLst.add", after: "256" })).toEqual({
      changed: ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "[Content_Types].xml"],
      added: ["ppt/slides/slide4.xml", "ppt/slides/_rels/slide4.xml.rels"],
      removed: [],
    })
  })

  it("removes the slide the relationship names, not the next file number", () => {
    expect(partTouch(hosts(), { name: "sldIdLst.remove", slide: "257" })).toEqual({
      changed: ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "[Content_Types].xml"],
      added: [],
      removed: ["ppt/slides/slide3.xml", "ppt/slides/_rels/slide3.xml.rels"],
    })
  })

  it("rejects a byte change outside the declared parts", () => {
    const before = hosts()
    const after = new Map(before)
    after.set("ppt/slides/slide1.xml", text("<p:sld>edited</p:sld>"))
    after.set("ppt/media/keep.bin", Uint8Array.of(9))
    expect(touchMatches(before, after, { changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })).toBe(false)
  })

  it("rejects a declared part that did not change", () => {
    const before = hosts()
    expect(touchMatches(before, before, { changed: ["ppt/slides/slide1.xml"], added: [], removed: [] })).toBe(false)
  })
})

describe("routeRuns", () => {
  it("attempts every written route when the deck has a host for each", () => {
    const operations = routeRuns(hosts()).map((run) => run.operation)
    expect([...operations].sort()).toEqual(routeOperations.filter((operation) => operation !== "notes.body").sort())
  })

  it("does not remove the only row of a table", () => {
    const parts = hosts()
    const bytes = parts.get("ppt/slides/slide1.xml")
    if (bytes === undefined) throw new Error("part")
    parts.set(
      "ppt/slides/slide1.xml",
      text(decodeUtf8(bytes).replace(`<a:tr h="2"><a:tc><a:t>B</a:t></a:tc></a:tr>`, "")),
    )
    const runs = routeRuns(parts)
    const operations = runs.map((run) => run.operation)
    expect(operations).toContain("tbl.addRow")
    expect(operations).not.toContain("tbl.removeRow")
    expect(runs.filter((run) => run.operation.startsWith("tbl.") && run.error !== null)).toEqual([])
  })

  it("removes a row of a table that has two, not the last row of the slide", () => {
    const parts = hosts()
    const bytes = parts.get("ppt/slides/slide1.xml")
    if (bytes === undefined) throw new Error("part")
    const lone = `<a:tbl><a:tr h="3"><a:tc><a:t>C</a:t></a:tc></a:tr></a:tbl>`
    parts.set("ppt/slides/slide1.xml", text(decodeUtf8(bytes).replace("</p:spTree>", `${lone}</p:spTree>`)))
    const run = routeRuns(parts).find((item) => item.operation === "tbl.removeRow")
    expect(run?.error).toBeNull()
  })

  it("picks a shape to remove that no animation refers to", () => {
    const parts = hosts()
    const first = routeRuns(parts).find((run) => run.operation === "spTree.remove")?.edit
    if (first?.name !== "spTree.remove") throw new Error("spTree.remove run")
    const bytes = parts.get(first.part)
    if (bytes === undefined) throw new Error("part")
    const timing = `</p:spTree><p:timing><p:spTgt spid="${first.shape}"/></p:timing>`
    parts.set(first.part, text(decodeUtf8(bytes).replace("</p:spTree>", timing)))
    const run = routeRuns(parts).find((item) => item.operation === "spTree.remove")
    if (run?.edit?.name !== "spTree.remove") throw new Error("spTree.remove run")
    expect(run.error).toBeNull()
    expect(run.edit.shape).not.toBe(first.shape)
  })

  it("does not pick a group whose child is animated", () => {
    const parts = hosts()
    const child = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Child"/></p:nvSpPr></p:sp>`
    const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="Group"/></p:nvGrpSpPr>${child}</p:grpSp>`
    const free = `<p:sp><p:nvSpPr><p:cNvPr id="4" name="Free"/></p:nvSpPr></p:sp>`
    parts.set(
      "ppt/slides/slide1.xml",
      text(`<p:sld><p:spTree>${group}${free}</p:spTree><p:timing><p:spTgt spid="3"/></p:timing></p:sld>`),
    )
    const run = routeRuns(parts).find((item) => item.operation === "spTree.remove")
    expect(run?.error).toBeNull()
    expect(run?.edit).toMatchObject({ shape: "4" })
  })

  it("a real animated shape is refused, and a hand cut that leaves its target fails the judge", () => {
    const targets = decks.flatMap((deck) =>
      [...deck.parts].flatMap(([part, bytes]) => {
        if (!part.startsWith("ppt/slides/slide")) return []
        const spid = markup(bytes)
          .find((element) => element.kind === "p:spTgt")
          ?.attributes.find((item) => item.name === "spid")?.value
        return spid === undefined ? [] : [{ parts: deck.parts, part, bytes, shape: spid }]
      }),
    )
    expect(targets.length).toBeGreaterThan(0)
    for (const { parts, part, bytes, shape } of targets) {
      expect(() => applyStructuralRoute(parts, { name: "spTree.remove", part, shape })).toThrow(/^shape-animated$/)
      const cut = new Map(parts).set(part, cutOut(bytes, shapeById(markup(bytes), shape)))
      expect(newDanglingShapeReferences(danglingShapeReferences(parts), danglingShapeReferences(cut))).toContainEqual({
        part,
        kind: "p:spTgt",
        id: shape,
      })
    }
  })

  it("a text write on a real deck changes only the bytes of its own shape", () => {
    for (const deck of decks) {
      const run = runOf(deck, "text")
      if (run.edit?.name !== "text" || run.parts === null) throw new Error("text run")
      expect([...run.parts.keys()]).toEqual([...deck.parts.keys()])
      expect(run.edit.value.some((item) => item.runs.length >= 2 && item.runs.some(isProbe))).toBe(true)
      expectInside(deck.parts, run.parts, run.edit)
    }
  })

  it("every route on a real deck writes only what it asked inside its own part", () => {
    const seen = new Set<string>()
    for (const deck of decks) {
      for (const run of deck.runs) {
        expect(run.error).toBeNull()
        if (run.parts === null || run.touch === null) continue
        expect(touchMatches(deck.parts, run.parts, run.touch)).toBe(true)
        if (run.edit === null) continue
        seen.add(run.operation)
        if (!run.operation.startsWith("text.format")) expectInside(deck.parts, run.parts, run.edit)
      }
    }
    expect([...seen].sort()).toEqual(
      routeOperations.filter((operation) => operation !== "element.export" && operation !== "notes.body").sort(),
    )
  })

  it("a shape with its own box on a real deck changes only those values", () => {
    for (const deck of decks) {
      const move = ownBox(deck.parts, "a:off")
      const resize = ownBox(deck.parts, "a:ext")
      const edits: SlideRoute[] = [
        { name: "move", part: move.part, shape: move.shape, x: move.first + 9525, y: move.second + 9525 },
        { name: "resize", part: resize.part, shape: resize.shape, cx: resize.first + 9525, cy: resize.second + 9525 },
      ]
      for (const edit of edits) expectInside(deck.parts, applyRoute(deck.parts, edit), edit)
    }
  })

  it("a forward order on a real deck puts the element just before its target", () => {
    const seen = new Set<string>()
    for (const deck of decks) {
      for (const { base, edit } of forwardOrders(deck.parts)) {
        seen.add(edit.name)
        expectInside(base, applyStructuralRoute(base, edit), edit)
      }
    }
    expect([...seen].sort()).toEqual(["sectionLst.order", "sldIdLst.order", "spTree.order", "tbl.orderRow"])
  })

  it("an added shape on a real deck takes each number of the box it asked", () => {
    for (const deck of decks) {
      const added = runOf(deck, "spTree.add").edit
      if (added?.name !== "spTree.add") throw new Error("spTree.add run")
      const edit = { ...added, x: 101, y: 202, cx: 303, cy: 404 }
      expectInside(deck.parts, applyStructuralRoute(deck.parts, edit), edit)
    }
  })

  it("text with markup characters on a real deck reads back exactly", () => {
    for (const deck of decks) {
      const added = runOf(deck, "spTree.add").edit
      if (added?.name !== "spTree.add") throw new Error("spTree.add run")
      const shape = { ...added, text: markedText }
      expectInside(deck.parts, applyStructuralRoute(deck.parts, shape), shape)
      const written = runOf(deck, "text").edit
      if (written?.name !== "text") throw new Error("text run")
      const value = written.value.map((item) => ({
        ...item,
        runs: item.runs.map((run) => (isProbe(run) ? { ...run, text: markedText } : run)),
      }))
      const edit = { ...written, value }
      expectInside(deck.parts, applyRoute(deck.parts, edit), edit)
    }
  })

  it("a new slide on a real deck takes a free file number when the numbering has a gap", () => {
    for (const deck of decks) {
      const ids = slideIds(deck.parts)
      const gone = ids.find(
        (slide) => !applyStructuralRoute(deck.parts, { name: "sldIdLst.remove", slide }).has(firstSlidePart),
      )
      const source = ids.find((slide) => slide !== gone)
      if (gone === undefined || source === undefined) throw new Error("slide")
      const gapped = applyStructuralRoute(deck.parts, { name: "sldIdLst.remove", slide: gone })
      const edits: StructuralEdit[] = [
        { name: "sldIdLst.add", after: source },
        { name: "sldIdLst.clone", slide: source },
      ]
      for (const edit of edits) {
        const after = applyStructuralRoute(gapped, edit)
        expect(touchMatches(gapped, after, partTouch(gapped, edit))).toBe(true)
        expectInside(gapped, after, edit)
      }
    }
  })
})
