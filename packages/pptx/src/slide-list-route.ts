import { withoutSlideLinks } from "./trait-xml-link.js"
import type { MarkupElement } from "./element-span.js"
import {
  contentTypesPart,
  partOf,
  presentationPart,
  presentationRels,
  relativeTarget,
  relsOf,
} from "./package-address.js"
import { encodeUtf8 } from "./package-bytes.js"
import {
  attribute,
  cut,
  digits,
  elementById,
  insertAt,
  moveBytes,
  partBytes,
  replacePart,
  requireMarkup,
  rootClose,
} from "./part-markup.js"
import { copyOwnedParts } from "./owned-parts.js"
import { dropNotes, onlyNotes } from "./slide-notes.js"
import { layoutPart } from "./slide-placeholders.js"

const slideRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide"
const layoutRelType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
const slideContentType = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
const slidePrefix = "ppt/slides/slide"
const slideSuffix = ".xml"

const blankSlide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld></p:sld>`

export function slideFileNumber(name: string): number | null {
  if (!name.startsWith(slidePrefix) || !name.endsWith(slideSuffix)) return null
  return digits(name.slice(slidePrefix.length, name.length - slideSuffix.length))
}

export function nextSlideFile(parts: ReadonlyMap<string, Uint8Array>): number {
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

export function nextRelationshipId(elements: readonly MarkupElement[]): string {
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

const largestSlideId = 2147483647

function namedSlideId(elements: readonly MarkupElement[], id: string | undefined): string {
  if (id === undefined) return String(nextNumbered(elements, "p:sldId"))
  const number = digits(id)
  const taken = elements.some((element) => element.kind === "p:sldId" && element.id === id)
  if (number === null || number < 256 || number > largestSlideId || taken) throw new Error("slide")
  return id
}

function layoutOnlyRelationships(slide: string, layout: string): Uint8Array {
  return encodeUtf8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${layoutRelType}" Target="${relativeTarget(slide, layout)}"/></Relationships>`,
  )
}

export function addSlide(parts: Map<string, Uint8Array>, after: string, copy: boolean, id?: string, layout?: string) {
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
  const newId = namedSlideId(presentationDocument.elements, id)
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
  parts.set(
    relsOf(part),
    copy
      ? copyOwnedParts(parts, sourcePart, part, sourceRelBytes)
      : layout === undefined || layoutPart(parts, sourcePart) === layout
        ? layoutRelationships(sourceRelBytes)
        : layoutOnlyRelationships(part, layout),
  )
  return newId
}

export function removeSlide(parts: Map<string, Uint8Array>, slide: string) {
  const presentation = partBytes(parts, presentationPart)
  const rels = partBytes(parts, presentationRels)
  const types = partBytes(parts, contentTypesPart)
  const source = elementById(requireMarkup(presentation).elements, "p:sldId", slide, "slide")
  const rid = attribute(source, "r:id", "slide")
  const relDocument = requireMarkup(rels)
  const relationship = relationshipById(relDocument.elements, rid)
  const part = partOf(presentationPart, attribute(relationship, "Target", "slide"))
  const override = overridePart(requireMarkup(types).elements, part)
  withoutSlideLinks(parts, part)
  const notes = onlyNotes(parts, part)
  replacePart(parts, presentationPart, cut(presentation, source.start, source.end))
  replacePart(parts, presentationRels, cut(rels, relationship.start, relationship.end))
  replacePart(parts, contentTypesPart, cut(types, override.start, override.end))
  parts.delete(part)
  parts.delete(relsOf(part))
  if (notes !== null) dropNotes(parts, notes)
}

export function orderSlide(bytes: Uint8Array, slide: string, before: string): Uint8Array {
  if (slide === before) throw new Error("slide")
  const document = requireMarkup(bytes)
  return moveBytes(
    bytes,
    elementById(document.elements, "p:sldId", slide, "slide"),
    elementById(document.elements, "p:sldId", before, "slide"),
  )
}
