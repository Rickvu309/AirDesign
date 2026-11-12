import type { Media } from "@airdesign/document"
import { markupDocument, type MarkupElement } from "./element-span.js"
import { contentTypesPart, partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { insertAt, partBytes, requireMarkup, rootClose } from "./part-markup.js"
import { appendShape, shapeBox, type ShapeBox } from "./shape-write.js"

export type AddedPicture = {
  readonly id: number
  readonly box: ShapeBox
  readonly media: Media
  readonly bytes: Uint8Array | undefined
}

const imageType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
const relationshipsNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

const extensions: Readonly<Record<Media["type"], string>> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/gif": "gif",
}

function value(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

const addedPrefix = "ppt/media/picture-"

export function addedPicturePart(part: string): boolean {
  return part.startsWith(addedPrefix)
}

function mediaName(parts: ReadonlyMap<string, Uint8Array>, picture: AddedPicture): string {
  const extension = extensions[picture.media.type]
  const stem = `${addedPrefix}${picture.media.sha256.slice(0, 16)}`
  for (let copy = 1; ; copy += 1) {
    const name = copy === 1 ? `${stem}.${extension}` : `${stem}-${String(copy)}.${extension}`
    const held = parts.get(name)
    if (held === undefined) return name
    if (picture.bytes !== undefined && sameBytes(held, picture.bytes)) return name
  }
}

function relativeTarget(slide: string, part: string): string {
  const from = slide.split("/").slice(0, -1)
  const to = part.split("/")
  let shared = 0
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/")
}

function linked(parts: Map<string, Uint8Array>, slide: string, media: string): string {
  const name = relsOf(slide)
  const rels = parts.get(name) ?? encodeUtf8(emptyRels)
  const document = requireMarkup(rels)
  let highest = 0
  for (const element of document.elements) {
    if (element.kind !== "Relationship") continue
    const id = value(element, "Id") ?? ""
    const target = value(element, "Target")
    const internal = value(element, "TargetMode") !== "External"
    if (internal && target !== null && value(element, "Type") === imageType && partOf(slide, target) === media)
      return id
    const number = /^rId([0-9]{1,9})$/.exec(id)?.[1]
    if (number !== undefined) highest = Math.max(highest, Number(number))
  }
  const id = `rId${String(highest + 1)}`
  const row = `<Relationship Id="${id}" Type="${imageType}" Target="${relativeTarget(slide, media)}"/>`
  parts.set(name, insertAt(rels, rootClose(document, "Relationships", "rels"), encodeUtf8(row)))
  return id
}

function typed(parts: Map<string, Uint8Array>, media: Media) {
  const extension = extensions[media.type]
  const types = partBytes(parts, contentTypesPart)
  const document = requireMarkup(types)
  const known = document.elements.some(
    (element) => element.kind === "Default" && value(element, "Extension")?.toLowerCase() === extension,
  )
  if (known) return
  const row = `<Default Extension="${extension}" ContentType="${media.type}"/>`
  parts.set(contentTypesPart, insertAt(types, rootClose(document, "Types", "types"), encodeUtf8(row)))
}

function declaresRelationships(slideXml: string): boolean {
  const root = markupDocument(encodeUtf8(slideXml)).elements.find((element) => element.parent < 0)
  return root !== undefined && value(root, "xmlns:r") === relationshipsNamespace
}

function pictureMarkup(id: string, embed: string, box: ShapeBox, declared: boolean): string {
  const namespace = declared ? "" : ` xmlns:r="${relationshipsNamespace}"`
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip${namespace} r:embed="${embed}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${shapeBox(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}

export function addPicture(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  picture: AddedPicture,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const slideXml = decodeUtf8(partBytes(next, slide))
  const media = mediaName(next, picture)
  const embed = linked(next, slide, media)
  const written = appendShape(
    slideXml,
    (id) => pictureMarkup(id, embed, picture.box, declaresRelationships(slideXml)),
    picture.id,
  )
  next.set(slide, encodeUtf8(written.xml))
  typed(next, picture.media)
  if (picture.bytes !== undefined && !next.has(media)) next.set(media, picture.bytes)
  return next
}
