import { assetIcon, type Media } from "@airdesign/document"
import { fillWritten } from "./blip-edit.js"
import { spliceBytes, markupDocument, type MarkupElement } from "./element-span.js"
import type { ElementAt } from "./xml-codec.js"
import { contentTypesPart, partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { insertAt, partBytes, requireMarkup, rootClose } from "./part-markup.js"
import { appendShape, shapeBox, type ShapeBox } from "./shape-write.js"
import { placementXml } from "./picture-placement.js"
import { rasterDimensions } from "./raster-dimensions.js"

export type AddedPicture = {
  readonly id: number
  readonly box: ShapeBox
  readonly source: { readonly media: Media; readonly bytes: Uint8Array | undefined } | { readonly icon: string }
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
const iconPrefix = "ppt/media/icon-"

export function addedPicturePart(part: string): boolean {
  return part.startsWith(addedPrefix) || part.startsWith(iconPrefix)
}

export function iconParts(name: string): { readonly svg: string; readonly png: string } {
  return { svg: `${iconPrefix}${name}.svg`, png: `${iconPrefix}${name}.png` }
}

export function iconOfPart(part: string): string | null {
  const name = part.startsWith(iconPrefix) && part.endsWith(".svg") ? part.slice(iconPrefix.length, -".svg".length) : ""
  return assetIcon(name)
}

export function mediaName(parts: ReadonlyMap<string, Uint8Array>, media: Media, bytes: Uint8Array | undefined): string {
  const extension = extensions[media.type]
  const stem = `${addedPrefix}${media.sha256.slice(0, 16)}`
  for (let copy = 1; ; copy += 1) {
    const name = copy === 1 ? `${stem}.${extension}` : `${stem}-${String(copy)}.${extension}`
    const held = parts.get(name)
    if (held === undefined) return name
    if (bytes === undefined || sameBytes(held, bytes)) return name
  }
}

function relativeTarget(slide: string, part: string): string {
  const from = slide.split("/").slice(0, -1)
  const to = part.split("/")
  let shared = 0
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1
  return [...from.slice(shared).map(() => ".."), ...to.slice(shared)].join("/")
}

export function imageLink(parts: Map<string, Uint8Array>, slide: string, media: string): string {
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

export function mediaTyped(parts: Map<string, Uint8Array>, extension: string, contentType: string) {
  const types = partBytes(parts, contentTypesPart)
  const document = requireMarkup(types)
  const known = document.elements.some(
    (element) => element.kind === "Default" && value(element, "Extension")?.toLowerCase() === extension,
  )
  if (known) return
  const row = `<Default Extension="${extension}" ContentType="${contentType}"/>`
  parts.set(contentTypesPart, insertAt(types, rootClose(document, "Types", "types"), encodeUtf8(row)))
}

export function declaresRelationships(slideXml: string): boolean {
  const root = markupDocument(encodeUtf8(slideXml)).elements.find((element) => element.parent < 0)
  return root !== undefined && value(root, "xmlns:r") === relationshipsNamespace
}

export const svgExtension = "{96DAC541-7B7A-43D3-8B79-37D633B846F1}"

export function svgExt(embed: string): string {
  return `<a:ext uri="${svgExtension}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${embed}"/></a:ext>`
}

export function relationshipsAttribute(declared: boolean): string {
  return declared ? "" : ` xmlns:r="${relationshipsNamespace}"`
}

export type LinkedSource = { readonly embed: string; readonly svg: string | null }

export function linkedSource(
  parts: Map<string, Uint8Array>,
  slide: string,
  source: AddedPicture["source"],
): LinkedSource {
  if ("icon" in source) {
    const named = iconParts(source.icon)
    mediaTyped(parts, "png", "image/png")
    mediaTyped(parts, "svg", "image/svg+xml")
    return { embed: imageLink(parts, slide, named.png), svg: imageLink(parts, slide, named.svg) }
  }
  const media = mediaName(parts, source.media, source.bytes)
  mediaTyped(parts, extensions[source.media.type], source.media.type)
  if (source.bytes !== undefined && !parts.has(media)) parts.set(media, source.bytes)
  return { embed: imageLink(parts, slide, media), svg: null }
}

function digest(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  return hash.toString(16).padStart(8, "0").repeat(8)
}

function replacedFill(bytes: Uint8Array, fill: MarkupElement, inner: string): Uint8Array {
  if (!fill.selfClosing)
    return spliceBytes(bytes, [{ start: fill.openEnd, end: fill.closeStart, next: encodeUtf8(inner) }])
  const open = decodeUtf8(bytes.subarray(fill.start, fill.end))
    .trimEnd()
    .replace(/\/\s*>$/, ">")
  return spliceBytes(bytes, [{ start: fill.start, end: fill.end, next: encodeUtf8(`${open}${inner}</p:blipFill>`) }])
}

export function installedPicture(
  parts: ReadonlyMap<string, Uint8Array>,
  at: ElementAt,
  png: Uint8Array,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const linked = linkedSource(next, at.part, { media: { sha256: digest(png), type: "image/png" }, bytes: png })
  const declared = declaresRelationships(decodeUtf8(partBytes(next, at.part)))
  const inner = `${blipMarkup(linked, declared)}<a:stretch><a:fillRect/></a:stretch>`
  return fillWritten(next, at, (found) => replacedFill(found.bytes, found.fill, inner))
}

export function blipMarkup(linked: LinkedSource, declared: boolean): string {
  const namespace = relationshipsAttribute(declared)
  if (linked.svg === null) return `<a:blip${namespace} r:embed="${linked.embed}"/>`
  return `<a:blip${namespace} r:embed="${linked.embed}"><a:extLst>${svgExt(linked.svg)}</a:extLst></a:blip>`
}

function pictureMarkup(id: string, blip: string, box: ShapeBox, placement: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill>${blip}${placement}</p:blipFill><p:spPr>${shapeBox(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}

function addedPlacement(bytes: Uint8Array | undefined, box: ShapeBox): string {
  const image = bytes === undefined ? null : rasterDimensions(bytes)
  if (image === null || image.width <= 0 || image.height <= 0 || box.cx <= 0 || box.cy <= 0)
    return "<a:stretch><a:fillRect/></a:stretch>"
  return placementXml("fill", image, { width: box.cx, height: box.cy })
}

export function addPicture(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  picture: AddedPicture,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const slideXml = decodeUtf8(partBytes(next, slide))
  const linked = linkedSource(next, slide, picture.source)
  const blip = blipMarkup(linked, declaresRelationships(slideXml))
  const bytes =
    "media" in picture.source ? next.get(mediaName(next, picture.source.media, picture.source.bytes)) : undefined
  const placement = addedPlacement(bytes, picture.box)
  const written = appendShape(slideXml, (id) => pictureMarkup(id, blip, picture.box, placement), picture.id)
  next.set(slide, encodeUtf8(written.xml))
  return next
}

export function withMedia(
  parts: ReadonlyMap<string, Uint8Array>,
  bytes: (part: string) => Uint8Array | undefined,
): ReadonlyMap<string, Uint8Array> {
  let next: Map<string, Uint8Array> | null = null
  for (const [name, rels] of parts) {
    if (!name.endsWith(".rels")) continue
    const source = name.replace(/_rels\/([^/]+)\.rels$/, "$1")
    for (const element of markupDocument(rels).elements) {
      const target = element.kind === "Relationship" ? value(element, "Target") : null
      if (target === null || value(element, "TargetMode") === "External") continue
      const part = partOf(source, target)
      const held = addedPicturePart(part) && !parts.has(part) ? bytes(part) : undefined
      if (held === undefined) continue
      next ??= new Map(parts)
      next.set(part, held)
    }
  }
  return next ?? parts
}
