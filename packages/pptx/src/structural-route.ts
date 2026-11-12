import { tableFrame } from "./table-frame.js"
import { markupDocument, spliceBytes, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { partOf, presentationPart, presentationRels, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { nextShapeId } from "./shape-id.js"
import { addTextShape, xmlText } from "./shape-write.js"
import { removeShape, type RouteResult } from "./slide-route.js"
import { shapeById } from "./shape-tree.js"

export type StructuralEdit =
  | {
      readonly name: "spTree.add"
      readonly part: string
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "spTree.remove"; readonly part: string; readonly shape: string }
  | { readonly name: "spTree.order"; readonly part: string; readonly shape: string; readonly before: string }
  | { readonly name: "spTree.clone"; readonly part: string; readonly shape: string }
  | { readonly name: "sldIdLst.add"; readonly after: string }
  | { readonly name: "sldIdLst.remove"; readonly slide: string }
  | { readonly name: "sldIdLst.order"; readonly slide: string; readonly before: string }
  | { readonly name: "sldIdLst.clone"; readonly slide: string }
  | { readonly name: "sectionLst.add"; readonly title: string }
  | { readonly name: "sectionLst.remove"; readonly section: string }
  | { readonly name: "sectionLst.order"; readonly section: string; readonly before: string }
  | { readonly name: "graphicFrame.addTable"; readonly part: string }
  | { readonly name: "tbl.addRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.removeRow"; readonly part: string; readonly row: number }
  | { readonly name: "tbl.orderRow"; readonly part: string; readonly row: number; readonly before: number }

const contentTypesPart = "[Content_Types].xml"
const slideRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
const layoutRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
const slideContentType = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
const slidePrefix = "ppt/slides/slide"
const slideSuffix = ".xml"
const emptyBytes = new Uint8Array(0)

const blankSlide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sld>`

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function partBytes(parts: ReadonlyMap<string, Uint8Array>, name: string): Uint8Array {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error("part")
  return bytes
}

function replacePart(parts: Map<string, Uint8Array>, name: string, next: Uint8Array) {
  const before = parts.get(name)
  if (before !== undefined && sameBytes(before, next)) return
  parts.set(name, next)
}

function requireMarkup(bytes: Uint8Array): MarkupDocument {
  const document = markupDocument(bytes)
  if (!document.wellFormed) throw new Error("xml")
  return document
}

function attribute(element: MarkupElement, name: string, error: string): string {
  const found = element.attributes.find((item) => item.name === name)
  if (found === undefined || found.value === "") throw new Error(error)
  return found.value
}

function digits(value: string): number | null {
  if (value.length === 0) return null
  let number = 0
  for (const char of value) {
    const code = char.charCodeAt(0)
    if (code < 48 || code > 57) return null
    number = number * 10 + (code - 48)
    if (!Number.isSafeInteger(number)) return null
  }
  return number
}

function elementById(elements: readonly MarkupElement[], kind: string, id: string, error: string): MarkupElement {
  const found = elements.find((element) => element.kind === kind && element.id === id)
  if (found === undefined) throw new Error(error)
  return found
}

function within(elements: readonly MarkupElement[], child: MarkupElement, ancestor: MarkupElement): boolean {
  let parent = child.parent
  while (parent >= 0) {
    if (parent === ancestor.index) return true
    const next = elements[parent]
    if (next === undefined) return false
    parent = next.parent
  }
  return false
}

function insertAt(bytes: Uint8Array, at: number, next: Uint8Array): Uint8Array {
  return spliceBytes(bytes, [{ start: at, end: at, next }])
}

function cut(bytes: Uint8Array, start: number, end: number): Uint8Array {
  return spliceBytes(bytes, [{ start, end, next: emptyBytes }])
}

function moveBytes(bytes: Uint8Array, moving: MarkupElement, target: MarkupElement): Uint8Array {
  if (moving.start === target.start) throw new Error("span")
  if (moving.start < target.end && target.start < moving.end) throw new Error("span")
  const piece = bytes.slice(moving.start, moving.end)
  const without = cut(bytes, moving.start, moving.end)
  const shift = moving.start < target.start ? moving.end - moving.start : 0
  return insertAt(without, target.start - shift, piece)
}

function rootClose(document: MarkupDocument, kind: string, error: string): number {
  const found = document.elements.find((element) => element.kind === kind && element.parent < 0)
  if (found === undefined || found.selfClosing || found.closeStart < 0) throw new Error(error)
  return found.closeStart
}

function rowAt(elements: readonly MarkupElement[], index: number): MarkupElement {
  if (!Number.isInteger(index) || index < 1) throw new Error("a:tr")
  const row = elements.filter((element) => element.kind === "a:tr")[index - 1]
  if (row === undefined) throw new Error("a:tr")
  return row
}

function replaceShapeId(piece: Uint8Array, from: string, to: string): Uint8Array {
  const document = requireMarkup(piece)
  const mark = document.elements.find((element) => element.kind === "p:cNvPr" && element.id === from)
  if (mark === undefined) throw new Error("shape")
  const id = mark.attributes.find((item) => item.name === "id")
  if (id === undefined) throw new Error("shape")
  return spliceBytes(piece, [{ start: id.valueStart, end: id.valueEnd, next: encodeUtf8(to) }])
}

function editPart(parts: Map<string, Uint8Array>, name: string, edit: (bytes: Uint8Array) => Uint8Array) {
  const before = partBytes(parts, name)
  replacePart(parts, name, edit(before))
}

function orderShape(bytes: Uint8Array, shape: string, before: string): Uint8Array {
  if (shape === before) throw new Error("shape")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, shapeById(document.elements, shape), shapeById(document.elements, before))
}

function cloneShape(bytes: Uint8Array, shape: string): Uint8Array {
  const document = requireMarkup(bytes)
  const found = shapeById(document.elements, shape)
  let piece: Uint8Array = new Uint8Array(bytes.subarray(found.start, found.end))
  const marks = requireMarkup(piece).elements.filter((element) => element.kind === "p:cNvPr" && element.id !== null)
  let next = nextShapeId(decodeUtf8(bytes))
  for (const mark of marks.slice().reverse()) {
    if (mark.id === null) continue
    piece = replaceShapeId(piece, mark.id, String(next))
    next += 1
  }
  return insertAt(bytes, found.end, piece)
}

function addTable(bytes: Uint8Array): Uint8Array {
  const document = requireMarkup(bytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (tree === undefined || tree.selfClosing || tree.closeStart < 0) throw new Error("p:spTree")
  return insertAt(bytes, tree.closeStart, encodeUtf8(tableFrame(nextShapeId(decodeUtf8(bytes)))))
}

function addRow(bytes: Uint8Array, row: number): Uint8Array {
  const found = rowAt(requireMarkup(bytes).elements, row)
  return insertAt(bytes, found.end, bytes.slice(found.start, found.end))
}

function tableOf(elements: readonly MarkupElement[], row: MarkupElement): MarkupElement | null {
  let parent = row.parent
  while (parent >= 0) {
    const next = elements[parent]
    if (next === undefined) return null
    if (next.kind === "a:tbl") return next
    parent = next.parent
  }
  return null
}

function removeRow(bytes: Uint8Array, row: number): Uint8Array {
  const elements = requireMarkup(bytes).elements
  const found = rowAt(elements, row)
  const table = tableOf(elements, found)
  if (table === null) throw new Error("a:tr")
  const count = elements.filter((element) => element.kind === "a:tr" && within(elements, element, table)).length
  if (count < 2) throw new Error("a:tr")
  return cut(bytes, found.start, found.end)
}

function orderRow(bytes: Uint8Array, row: number, before: number): Uint8Array {
  if (row === before) throw new Error("a:tr")
  const document = requireMarkup(bytes)
  return moveBytes(bytes, rowAt(document.elements, row), rowAt(document.elements, before))
}

function slideFileNumber(name: string): number | null {
  if (!name.startsWith(slidePrefix) || !name.endsWith(slideSuffix)) return null
  return digits(name.slice(slidePrefix.length, name.length - slideSuffix.length))
}

function nextSlideFile(parts: ReadonlyMap<string, Uint8Array>): number {
  let max = 0
  for (const name of parts.keys()) {
    const value = slideFileNumber(name)
    if (value !== null && value > max) max = value
  }
  return max + 1
}

function nextNumbered(elements: readonly MarkupElement[], kind: string): number {
  let max = 0
  for (const element of elements) {
    if (element.kind !== kind || element.id === null) continue
    const value = digits(element.id)
    if (value !== null && value > max) max = value
  }
  return max + 1
}

function nextRelationshipId(elements: readonly MarkupElement[]): string {
  let max = 0
  for (const element of elements) {
    if (element.kind !== "Relationship") continue
    const id = element.attributes.find((item) => item.name === "Id")?.value
    if (id === undefined || !id.startsWith("rId")) continue
    const value = digits(id.slice(3))
    if (value !== null && value > max) max = value
  }
  return `rId${max + 1}`
}

function relationshipById(elements: readonly MarkupElement[], id: string): MarkupElement {
  const found = elements.find(
    (element) =>
      element.kind === "Relationship" && element.attributes.some((item) => item.name === "Id" && item.value === id),
  )
  if (found === undefined) throw new Error("slide")
  return found
}

function overridePart(elements: readonly MarkupElement[], part: string): MarkupElement {
  const name = `/${part}`
  const found = elements.find(
    (element) =>
      element.kind === "Override" && element.attributes.some((item) => item.name === "PartName" && item.value === name),
  )
  if (found === undefined) throw new Error("part")
  return found
}

function layoutRelationships(rels: Uint8Array): Uint8Array {
  const document = requireMarkup(rels)
  const relationships = document.elements.filter((element) => element.kind === "Relationship")
  const layouts = relationships.filter((element) =>
    element.attributes.some((item) => item.name === "Type" && item.value === layoutRelType),
  )
  if (layouts.length === 0) throw new Error("part")
  let next = rels
  for (const element of relationships.slice().reverse()) {
    if (layouts.includes(element)) continue
    next = cut(next, element.start, element.end)
  }
  return next
}

function addSlide(parts: Map<string, Uint8Array>, after: string, copy: boolean) {
  const presentation = partBytes(parts, presentationPart)
  const rels = partBytes(parts, presentationRels)
  const types = partBytes(parts, contentTypesPart)
  const presentationDocument = requireMarkup(presentation)
  const source = elementById(presentationDocument.elements, "p:sldId", after, "slide")
  const rid = attribute(source, "r:id", "slide")
  const relDocument = requireMarkup(rels)
  const relationship = relationshipById(relDocument.elements, rid)
  const sourcePart = partOf(presentationPart, attribute(relationship, "Target", "slide"))
  const sourceRels = relsOf(sourcePart)
  const sourceBytes = parts.get(sourcePart)
  const sourceRelBytes = parts.get(sourceRels)
  if (sourceBytes === undefined || sourceRelBytes === undefined) throw new Error("part")
  const number = nextSlideFile(parts)
  const newRid = nextRelationshipId(relDocument.elements)
  const newId = String(nextNumbered(presentationDocument.elements, "p:sldId"))
  const part = partOf(presentationPart, `slides/slide${number}.xml`)
  const typeDocument = requireMarkup(types)
  replacePart(
    parts,
    presentationPart,
    insertAt(presentation, source.end, encodeUtf8(`<p:sldId id="${newId}" r:id="${newRid}"/>`)),
  )
  replacePart(
    parts,
    presentationRels,
    insertAt(
      rels,
      rootClose(relDocument, "Relationships", "part"),
      encodeUtf8(`<Relationship Id="${newRid}" Type="${slideRelType}" Target="slides/slide${number}.xml"/>`),
    ),
  )
  replacePart(
    parts,
    contentTypesPart,
    insertAt(
      types,
      rootClose(typeDocument, "Types", "part"),
      encodeUtf8(`<Override PartName="/${part}" ContentType="${slideContentType}"/>`),
    ),
  )
  parts.set(part, copy ? sourceBytes : encodeUtf8(blankSlide))
  parts.set(relsOf(part), copy ? sourceRelBytes : layoutRelationships(sourceRelBytes))
  return newId
}

function removeSlide(parts: Map<string, Uint8Array>, slide: string) {
  const presentation = partBytes(parts, presentationPart)
  const rels = partBytes(parts, presentationRels)
  const types = partBytes(parts, contentTypesPart)
  const source = elementById(requireMarkup(presentation).elements, "p:sldId", slide, "slide")
  const rid = attribute(source, "r:id", "slide")
  const relDocument = requireMarkup(rels)
  const relationship = relationshipById(relDocument.elements, rid)
  const part = partOf(presentationPart, attribute(relationship, "Target", "slide"))
  const override = overridePart(requireMarkup(types).elements, part)
  replacePart(parts, presentationPart, cut(presentation, source.start, source.end))
  replacePart(parts, presentationRels, cut(rels, relationship.start, relationship.end))
  replacePart(parts, contentTypesPart, cut(types, override.start, override.end))
  parts.delete(part)
  parts.delete(relsOf(part))
}

function orderSlide(bytes: Uint8Array, slide: string, before: string): Uint8Array {
  if (slide === before) throw new Error("slide")
  const document = requireMarkup(bytes)
  return moveBytes(
    bytes,
    elementById(document.elements, "p:sldId", slide, "slide"),
    elementById(document.elements, "p:sldId", before, "slide"),
  )
}

function attributeText(value: string): string {
  return xmlText(value).replaceAll('"', "&quot;")
}

const sectionUri = "{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"
const sectionNamespace = "http://schemas.microsoft.com/office/powerpoint/2010/main"
const sectionKind = "p14:section"
const sectionListKind = "p14:sectionLst"

function sectionGuid(elements: readonly MarkupElement[]): string {
  const used = new Set(
    elements
      .filter((element) => (element.kind === sectionKind || element.kind === "p:section") && element.id !== null)
      .map((element) => element.id),
  )
  for (let number = 1; number <= used.size + 1; number += 1) {
    const id = `{00000000-0000-4000-8000-${String(number).padStart(12, "0")}}`
    if (!used.has(id)) return id
  }
  throw new Error("section")
}

function sectionXml(title: string, id: string): string {
  return `<p14:section name="${attributeText(title)}" id="${id}"><p14:sldIdLst/></p14:section>`
}

function addSection(bytes: Uint8Array, title: string): Uint8Array {
  const document = requireMarkup(bytes)
  const section = sectionXml(title, sectionGuid(document.elements))
  const list = document.elements.find((element) => element.kind === sectionListKind)
  if (list !== undefined) {
    if (list.selfClosing || list.closeStart < 0) throw new Error("section")
    return insertAt(bytes, list.closeStart, encodeUtf8(section))
  }
  const listXml = `<${sectionListKind} xmlns:p14="${sectionNamespace}">${section}</${sectionListKind}>`
  const extension = document.elements.find(
    (element) =>
      element.kind === "p:ext" && element.attributes.some((item) => item.name === "uri" && item.value === sectionUri),
  )
  if (extension !== undefined) {
    if (extension.selfClosing || extension.closeStart < 0) throw new Error("section")
    return insertAt(bytes, extension.closeStart, encodeUtf8(listXml))
  }
  const extXml = `<p:ext uri="${sectionUri}">${listXml}</p:ext>`
  const extList = document.elements.find((element) => element.kind === "p:extLst")
  if (extList !== undefined) {
    if (extList.selfClosing || extList.closeStart < 0) throw new Error("section")
    return insertAt(bytes, extList.closeStart, encodeUtf8(extXml))
  }
  return insertAt(bytes, rootClose(document, "p:presentation", "section"), encodeUtf8(`<p:extLst>${extXml}</p:extLst>`))
}

function directChildren(elements: readonly MarkupElement[], parent: MarkupElement): MarkupElement[] {
  return elements.filter((element) => element.parent === parent.index)
}

function removeSection(bytes: Uint8Array, section: string): Uint8Array {
  const document = requireMarkup(bytes)
  const found = elementById(document.elements, sectionKind, section, "section")
  const list = document.elements.find(
    (element) => element.kind === sectionListKind && within(document.elements, found, element),
  )
  if (list === undefined) throw new Error("section")
  const count = document.elements.filter(
    (element) => element.kind === sectionKind && within(document.elements, element, list),
  ).length
  if (count > 1) return cut(bytes, found.start, found.end)
  const extension = document.elements.find(
    (element) => element.kind === "p:ext" && within(document.elements, list, element),
  )
  const extList =
    extension === undefined
      ? undefined
      : document.elements.find(
          (element) => element.kind === "p:extLst" && within(document.elements, extension, element),
        )
  if (
    extension !== undefined &&
    extList !== undefined &&
    directChildren(document.elements, extension).every((child) => child.kind === sectionListKind) &&
    directChildren(document.elements, extList).length === 1
  ) {
    return cut(bytes, extList.start, extList.end)
  }
  if (
    extension !== undefined &&
    directChildren(document.elements, extension).every((child) => child.kind === sectionListKind)
  ) {
    return cut(bytes, extension.start, extension.end)
  }
  return cut(bytes, list.start, list.end)
}

function orderSection(bytes: Uint8Array, section: string, before: string): Uint8Array {
  if (section === before) throw new Error("section")
  const document = requireMarkup(bytes)
  return moveBytes(
    bytes,
    elementById(document.elements, sectionKind, section, "section"),
    elementById(document.elements, sectionKind, before, "section"),
  )
}

export function writeStructuralRoute(parts: ReadonlyMap<string, Uint8Array>, route: StructuralEdit): RouteResult {
  const next = new Map(parts)
  switch (route.name) {
    case "spTree.add": {
      const written = addTextShape(decodeUtf8(partBytes(next, route.part)), route.text, {
        x: route.x,
        y: route.y,
        cx: route.cx,
        cy: route.cy,
      })
      replacePart(next, route.part, encodeUtf8(written.xml))
      return { parts: next, id: String(written.id) }
    }
    case "spTree.remove":
      editPart(next, route.part, (bytes) => removeShape(bytes, route.shape))
      return { parts: next, id: null }
    case "spTree.order":
      editPart(next, route.part, (bytes) => orderShape(bytes, route.shape, route.before))
      return { parts: next, id: null }
    case "spTree.clone":
      editPart(next, route.part, (bytes) => cloneShape(bytes, route.shape))
      return { parts: next, id: null }
    case "sldIdLst.add":
      return { parts: next, id: addSlide(next, route.after, false) }
    case "sldIdLst.clone":
      addSlide(next, route.slide, true)
      return { parts: next, id: null }
    case "sldIdLst.remove":
      removeSlide(next, route.slide)
      return { parts: next, id: null }
    case "sldIdLst.order":
      editPart(next, presentationPart, (bytes) => orderSlide(bytes, route.slide, route.before))
      return { parts: next, id: null }
    case "sectionLst.add":
      editPart(next, presentationPart, (bytes) => addSection(bytes, route.title))
      return { parts: next, id: null }
    case "sectionLst.remove":
      editPart(next, presentationPart, (bytes) => removeSection(bytes, route.section))
      return { parts: next, id: null }
    case "sectionLst.order":
      editPart(next, presentationPart, (bytes) => orderSection(bytes, route.section, route.before))
      return { parts: next, id: null }
    case "graphicFrame.addTable":
      editPart(next, route.part, addTable)
      return { parts: next, id: null }
    case "tbl.addRow":
      editPart(next, route.part, (bytes) => addRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.removeRow":
      editPart(next, route.part, (bytes) => removeRow(bytes, route.row))
      return { parts: next, id: null }
    case "tbl.orderRow":
      editPart(next, route.part, (bytes) => orderRow(bytes, route.row, route.before))
      return { parts: next, id: null }
    default: {
      const unexpected: never = route
      throw new Error(String(unexpected))
    }
  }
}

export function applyStructuralRoute(
  parts: ReadonlyMap<string, Uint8Array>,
  route: StructuralEdit,
): Map<string, Uint8Array> {
  return writeStructuralRoute(parts, route).parts
}
