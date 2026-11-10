import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { nextShapeId } from "./shape-id.js"
import { addTextShape } from "./shape-write.js"

export type StructuralRoute =
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

const presentationPart = "ppt/presentation.xml"
const presentationRels = "ppt/_rels/presentation.xml.rels"
const contentTypesPart = "[Content_Types].xml"
const slideRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
const slideContentType = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
const childTags = ["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"] as const

const blankSlide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sld>`

type Span = { readonly start: number; readonly end: number }

function xmlOf(parts: ReadonlyMap<string, Uint8Array>, name: string): string {
  const bytes = parts.get(name)
  if (bytes === undefined) throw new Error("part")
  return decodeUtf8(bytes)
}

function putXml(parts: Map<string, Uint8Array>, name: string, before: string, after: string) {
  if (before === after) return
  parts.set(name, encodeUtf8(after))
}

function copyPart(parts: Map<string, Uint8Array>, from: string, to: string) {
  const bytes = parts.get(from)
  if (bytes === undefined) throw new Error("part")
  parts.set(to, bytes)
}

function startsTag(xml: string, index: number, tag: string): boolean {
  const open = `<${tag}`
  if (!xml.startsWith(open, index)) return false
  const next = xml[index + open.length]
  return next === ">" || next === " " || next === "/" || next === "\n" || next === "\t" || next === "\r"
}

function elementSpan(xml: string, tag: string, at: number): Span {
  let start = -1
  for (let index = at; index >= 0; index -= 1) {
    if (startsTag(xml, index, tag)) {
      start = index
      break
    }
  }
  if (start < 0) throw new Error(tag)
  const openEnd = xml.indexOf(">", start)
  if (openEnd < 0) throw new Error(tag)
  if (xml[openEnd - 1] === "/") return { start, end: openEnd + 1 }
  const close = `</${tag}>`
  let depth = 0
  for (let index = start; index < xml.length;) {
    if (xml.startsWith(close, index)) {
      depth -= 1
      if (depth === 0) return { start, end: index + close.length }
      index += close.length
      continue
    }
    if (startsTag(xml, index, tag)) {
      depth += 1
      index += tag.length + 1
      continue
    }
    index += 1
  }
  throw new Error(tag)
}

function cutSpan(xml: string, span: Span): string {
  return xml.slice(0, span.start) + xml.slice(span.end)
}

function nthSpan(xml: string, tag: string, index: number): Span {
  if (!Number.isInteger(index) || index < 1) throw new Error(tag)
  let seen = 0
  let cursor = 0
  while (cursor < xml.length) {
    if (!startsTag(xml, cursor, tag)) {
      cursor += 1
      continue
    }
    const span = elementSpan(xml, tag, cursor)
    seen += 1
    if (seen === index) return span
    cursor = span.end
  }
  throw new Error(tag)
}

function childSpan(xml: string, shape: string): Span {
  const marker = `<p:cNvPr id="${shape}"`
  const at = xml.indexOf(marker)
  if (at < 0) throw new Error("shape")
  let start = -1
  let tag = ""
  for (const candidate of childTags) {
    const plain = xml.lastIndexOf(`<${candidate}>`, at)
    const spaced = xml.lastIndexOf(`<${candidate} `, at)
    const found = Math.max(plain, spaced)
    if (found > start) {
      start = found
      tag = candidate
    }
  }
  if (start < 0 || tag === "") throw new Error("shape")
  return elementSpan(xml, tag, start)
}

function movePiece(xml: string, moving: Span, target: Span): string {
  const piece = xml.slice(moving.start, moving.end)
  const without = xml.slice(0, moving.start) + xml.slice(moving.end)
  const shift = moving.start < target.start ? moving.end - moving.start : 0
  const at = target.start - shift
  return without.slice(0, at) + piece + without.slice(at)
}

function replaceShapeId(piece: string, shape: string, id: number): string {
  const marker = `<p:cNvPr id="${shape}"`
  const at = piece.indexOf(marker)
  if (at < 0) throw new Error("shape")
  return piece.slice(0, at) + `<p:cNvPr id="${id}"` + piece.slice(at + marker.length)
}

function editSlide(parts: Map<string, Uint8Array>, part: string, edit: (xml: string) => string) {
  const before = xmlOf(parts, part)
  putXml(parts, part, before, edit(before))
}

function orderShape(xml: string, shape: string, before: string): string {
  if (shape === before) throw new Error("shape")
  return movePiece(xml, childSpan(xml, shape), childSpan(xml, before))
}

function cloneShape(xml: string, shape: string): string {
  const span = childSpan(xml, shape)
  const copy = replaceShapeId(xml.slice(span.start, span.end), shape, nextShapeId(xml))
  return xml.slice(0, span.end) + copy + xml.slice(span.end)
}

function removeShape(xml: string, shape: string): string {
  return cutSpan(xml, childSpan(xml, shape))
}

function tableFrame(id: number): string {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="370840"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid><a:gridCol w="914400"/></a:tblGrid><a:tr h="370840"><a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></a:txBody><a:tcPr/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}

function addTable(xml: string): string {
  const close = "</p:spTree>"
  const at = xml.lastIndexOf(close)
  if (at < 0) throw new Error("p:spTree")
  return xml.slice(0, at) + tableFrame(nextShapeId(xml)) + xml.slice(at)
}

function orderRow(xml: string, row: number, before: number): string {
  if (row === before) throw new Error("a:tr")
  return movePiece(xml, nthSpan(xml, "a:tr", row), nthSpan(xml, "a:tr", before))
}

function cloneRow(xml: string, row: number): string {
  const span = nthSpan(xml, "a:tr", row)
  return xml.slice(0, span.end) + xml.slice(span.start, span.end) + xml.slice(span.end)
}

function slideIdSpan(xml: string, slide: string): Span {
  const marker = `<p:sldId id="${slide}"`
  const at = xml.indexOf(marker)
  if (at < 0) throw new Error("slide")
  return elementSpan(xml, "p:sldId", at)
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag)
  const value = match?.[1]
  if (value === undefined || value === "") throw new Error("slide")
  return value
}

function nextNumber(values: Iterable<string>, pattern: RegExp): number {
  let max = 0
  for (const value of values) {
    for (const match of value.matchAll(pattern)) {
      const found = Number(match[1])
      if (found > max) max = found
    }
  }
  return max + 1
}

function slidePart(target: string): string {
  if (target.startsWith("/")) return target.slice(1)
  if (target.startsWith("ppt/")) return target
  return `ppt/${target}`
}

function relsPart(part: string): string {
  const slash = part.lastIndexOf("/")
  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`
}

function relationshipTarget(rels: string, rid: string): string {
  const at = rels.indexOf(`Id="${rid}"`)
  if (at < 0) throw new Error("slide")
  const span = elementSpan(rels, "Relationship", at)
  return attribute(rels.slice(span.start, span.end), "Target")
}

function addSlide(parts: Map<string, Uint8Array>, after: string, copySlide: boolean) {
  const presentation = xmlOf(parts, presentationPart)
  const rels = xmlOf(parts, presentationRels)
  const types = xmlOf(parts, contentTypesPart)
  const source = slideIdSpan(presentation, after)
  const sourceTag = presentation.slice(source.start, source.end)
  const sourcePart = slidePart(relationshipTarget(rels, attribute(sourceTag, "r:id")))
  const sourceRels = relsPart(sourcePart)
  if (!parts.has(sourcePart) || !parts.has(sourceRels)) throw new Error("part")
  const number = nextNumber(parts.keys(), /\/slide(\d+)\.xml$/g)
  const rid = `rId${nextNumber([rels], /Id="rId(\d+)"/g)}`
  const id = String(nextNumber([presentation], /<p:sldId id="(\d+)"/g))
  const target = `slides/slide${number}.xml`
  const part = slidePart(target)
  if (!rels.includes("</Relationships>") || !types.includes("</Types>")) throw new Error("part")
  putXml(
    parts,
    presentationPart,
    presentation,
    presentation.slice(0, source.end) + `<p:sldId id="${id}" r:id="${rid}"/>` + presentation.slice(source.end),
  )
  putXml(
    parts,
    presentationRels,
    rels,
    rels.replace(
      "</Relationships>",
      `<Relationship Id="${rid}" Type="${slideRelType}" Target="${target}"/></Relationships>`,
    ),
  )
  putXml(
    parts,
    contentTypesPart,
    types,
    types.replace("</Types>", `<Override PartName="/${part}" ContentType="${slideContentType}"/></Types>`),
  )
  if (copySlide) copyPart(parts, sourcePart, part)
  else parts.set(part, encodeUtf8(blankSlide))
  copyPart(parts, sourceRels, relsPart(part))
}

function removeSlide(parts: Map<string, Uint8Array>, slide: string) {
  const presentation = xmlOf(parts, presentationPart)
  const rels = xmlOf(parts, presentationRels)
  const types = xmlOf(parts, contentTypesPart)
  const span = slideIdSpan(presentation, slide)
  const rid = attribute(presentation.slice(span.start, span.end), "r:id")
  const target = relationshipTarget(rels, rid)
  const part = slidePart(target)
  const relAt = rels.indexOf(`Id="${rid}"`)
  if (relAt < 0) throw new Error("slide")
  const typeMarker = `PartName="/${part}"`
  const typeAt = types.indexOf(typeMarker)
  if (typeAt < 0) throw new Error("part")
  putXml(parts, presentationPart, presentation, cutSpan(presentation, span))
  putXml(parts, presentationRels, rels, cutSpan(rels, elementSpan(rels, "Relationship", relAt)))
  putXml(parts, contentTypesPart, types, cutSpan(types, elementSpan(types, "Override", typeAt)))
  parts.delete(part)
  parts.delete(relsPart(part))
}

function sectionSpan(xml: string, section: string): Span {
  const token = `id="${section}"`
  let cursor = 0
  while (cursor < xml.length) {
    const at = xml.indexOf("<p:section ", cursor)
    if (at < 0) throw new Error("section")
    const span = elementSpan(xml, "p:section", at)
    if (xml.slice(span.start, span.end).includes(token)) return span
    cursor = span.end
  }
  throw new Error("section")
}

function nextSectionId(xml: string): number {
  let max = 0
  let cursor = 0
  while (cursor < xml.length) {
    const at = xml.indexOf("<p:section ", cursor)
    if (at < 0) break
    const end = xml.indexOf(">", at)
    const match = /id="(\d+)"/.exec(xml.slice(at, end))
    if (match?.[1]) max = Math.max(max, Number(match[1]))
    cursor = end + 1
  }
  return max + 1
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

function addSection(xml: string, title: string): string {
  const section = `<p:section name="${escapeAttribute(title)}" id="${nextSectionId(xml)}"><p:sldIdLst/></p:section>`
  const close = "</p:sectionLst>"
  const at = xml.indexOf(close)
  if (at >= 0) return xml.slice(0, at) + section + xml.slice(at)
  const anchor = xml.indexOf("<p:sldSz")
  if (anchor < 0) throw new Error("section")
  return xml.slice(0, anchor) + `<p:sectionLst>${section}</p:sectionLst>` + xml.slice(anchor)
}

function removeSection(xml: string, section: string): string {
  const span = sectionSpan(xml, section)
  const listAt = xml.lastIndexOf("<p:sectionLst", span.start)
  if (listAt < 0) throw new Error("section")
  const list = elementSpan(xml, "p:sectionLst", listAt)
  let count = 0
  let cursor = list.start
  while (cursor < list.end) {
    const at = xml.indexOf("<p:section ", cursor)
    if (at < 0 || at >= list.end) break
    count += 1
    cursor = elementSpan(xml, "p:section", at).end
  }
  if (count <= 1) return xml.slice(0, list.start) + xml.slice(list.end)
  return xml.slice(0, span.start) + xml.slice(span.end)
}

function orderSection(xml: string, section: string, before: string): string {
  if (section === before) throw new Error("section")
  return movePiece(xml, sectionSpan(xml, section), sectionSpan(xml, before))
}

function editPresentation(parts: Map<string, Uint8Array>, edit: (xml: string) => string) {
  editSlide(parts, presentationPart, edit)
}

export function applyStructuralRoute(
  parts: ReadonlyMap<string, Uint8Array>,
  route: StructuralRoute,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  if (route.name === "spTree.add") {
    editSlide(next, route.part, (xml) =>
      addTextShape(xml, route.text, { x: route.x, y: route.y, cx: route.cx, cy: route.cy }),
    )
    return next
  }
  if (route.name === "spTree.remove") {
    editSlide(next, route.part, (xml) => removeShape(xml, route.shape))
    return next
  }
  if (route.name === "spTree.order") {
    editSlide(next, route.part, (xml) => orderShape(xml, route.shape, route.before))
    return next
  }
  if (route.name === "spTree.clone") {
    editSlide(next, route.part, (xml) => cloneShape(xml, route.shape))
    return next
  }
  if (route.name === "sldIdLst.add") {
    addSlide(next, route.after, false)
    return next
  }
  if (route.name === "sldIdLst.clone") {
    addSlide(next, route.slide, true)
    return next
  }
  if (route.name === "sldIdLst.remove") {
    removeSlide(next, route.slide)
    return next
  }
  if (route.name === "sldIdLst.order") {
    editPresentation(next, (xml) => {
      if (route.slide === route.before) throw new Error("slide")
      return movePiece(xml, slideIdSpan(xml, route.slide), slideIdSpan(xml, route.before))
    })
    return next
  }
  if (route.name === "sectionLst.add") {
    editPresentation(next, (xml) => addSection(xml, route.title))
    return next
  }
  if (route.name === "sectionLst.remove") {
    editPresentation(next, (xml) => removeSection(xml, route.section))
    return next
  }
  if (route.name === "sectionLst.order") {
    editPresentation(next, (xml) => orderSection(xml, route.section, route.before))
    return next
  }
  if (route.name === "graphicFrame.addTable") {
    editSlide(next, route.part, addTable)
    return next
  }
  if (route.name === "tbl.addRow") {
    editSlide(next, route.part, (xml) => cloneRow(xml, route.row))
    return next
  }
  if (route.name === "tbl.removeRow") {
    editSlide(next, route.part, (xml) => cutSpan(xml, nthSpan(xml, "a:tr", route.row)))
    return next
  }
  editSlide(next, route.part, (xml) => orderRow(xml, route.row, route.before))
  return next
}
