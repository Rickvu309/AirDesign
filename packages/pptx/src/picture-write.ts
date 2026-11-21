import {
  assetIcon,
  iconWeights,
  readColor,
  type ColorTransform,
  type MappedSlot,
  type Media,
  type TemplateColor,
} from "@airdesign/document"
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
  readonly source: { readonly media: Media; readonly bytes: Uint8Array | undefined } | IconSource
}

export type IconSource = { readonly icon: string; readonly weight?: number; readonly color?: IconColor }

export type IconColor = {
  readonly hex: string
  readonly scheme?: TemplateColor | MappedSlot
  readonly transforms?: readonly ColorTransform[]
}

export type IconRef = { readonly name: string; readonly weight: number; readonly color: IconColor }

export const iconInk: IconColor = { hex: "000000" }

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

function transformWord(each: ColorTransform): string {
  return "val" in each ? `${each.op}${String(each.val)}` : each.op
}

function colorStem(color: IconColor): string {
  if (color.scheme === undefined && color.hex === iconInk.hex) return ""
  const slot = color.scheme === undefined ? [] : [color.scheme, ...(color.transforms ?? []).map(transformWord)]
  return [`.c${color.hex}`, ...slot.map((word) => `.${word}`)].join("")
}

export function iconParts(
  name: string,
  weight: number = iconWeights.lucide,
  color: IconColor = iconInk,
): { readonly svg: string; readonly png: string } {
  const weighed = weight === iconWeights.lucide ? "" : `.w${String(weight)}`
  const stem = `${iconPrefix}${name}${weighed}${colorStem(color)}`
  return { svg: `${stem}.svg`, png: `${stem}.png` }
}

const iconPart =
  /^ppt\/media\/icon-([a-z0-9-]+)(?:\.w([0-9]{1,4}))?(?:\.c([0-9A-F]{6})((?:\.[A-Za-z]+-?[0-9]*)*))?\.(?:svg|png)$/

const wordPart = /^([A-Za-z]+)(-?[0-9]+)?$/

function colorOf(hex: string, words: readonly string[]): IconColor | null {
  const [slot, ...rest] = words
  if (slot === undefined) return { hex }
  const transforms = rest.map((each) => {
    const found = wordPart.exec(each)
    if (found === null) return null
    return found[2] === undefined ? { op: found[1] } : { op: found[1], val: Number(found[2]) }
  })
  if (transforms.includes(null)) return null
  const color = readColor({ scheme: slot, ...(transforms.length === 0 ? {} : { transforms }) })
  if (color === null || color === undefined || !("scheme" in color)) return null
  return { hex, scheme: color.scheme, ...(color.transforms === undefined ? {} : { transforms: color.transforms }) }
}

export function iconOfPart(part: string): IconRef | null {
  const found = iconPart.exec(part)
  const name = found?.[1] === undefined ? null : assetIcon(found[1])
  if (found === null || name === null) return null
  const color = colorOf(found[3] ?? iconInk.hex, found[4]?.split(".").slice(1) ?? [])
  if (color === null) return null
  const weight = found[2] === undefined ? iconWeights.lucide : Number(found[2])
  const named = iconParts(name, weight, color)
  const kept = weight >= iconWeights.lightest && weight <= iconWeights.heaviest
  return kept && (named.svg === part || named.png === part) ? { name, weight, color } : null
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

export function declaresRelationshipsBytes(bytes: Uint8Array): boolean {
  const root = markupDocument(bytes).elements.find((element) => element.parent < 0)
  return root !== undefined && value(root, "xmlns:r") === relationshipsNamespace
}

export function declaresRelationships(slideXml: string): boolean {
  return declaresRelationshipsBytes(encodeUtf8(slideXml))
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
    const named = iconParts(source.icon, source.weight, source.color)
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

export function pictureShapeXml(
  parts: Map<string, Uint8Array>,
  slide: string,
  declared: boolean,
  picture: AddedPicture,
  id: string,
): string {
  const linked = linkedSource(parts, slide, picture.source)
  const blip = blipMarkup(linked, declared)
  const bytes =
    "media" in picture.source ? parts.get(mediaName(parts, picture.source.media, picture.source.bytes)) : undefined
  const placement = addedPlacement(bytes, picture.box)
  return pictureMarkup(id, blip, picture.box, placement)
}

export function addPicture(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  picture: AddedPicture,
): ReadonlyMap<string, Uint8Array> {
  const next = new Map(parts)
  const slideBytes = partBytes(next, slide)
  const slideXml = decodeUtf8(slideBytes)
  const declared = declaresRelationshipsBytes(slideBytes)
  const written = appendShape(slideXml, (id) => pictureShapeXml(next, slide, declared, picture, id), picture.id)
  next.set(slide, encodeUtf8(written.xml))
  return next
}

function unheldPictures(parts: ReadonlyMap<string, Uint8Array>): readonly string[] {
  const unheld = new Set<string>()
  for (const [name, rels] of parts) {
    if (!name.endsWith(".rels")) continue
    const source = name.replace(/_rels\/([^/]+)\.rels$/, "$1")
    for (const element of markupDocument(rels).elements) {
      const target = element.kind === "Relationship" ? value(element, "Target") : null
      if (target === null || value(element, "TargetMode") === "External") continue
      const part = partOf(source, target)
      if (addedPicturePart(part) && !parts.has(part)) unheld.add(part)
    }
  }
  return [...unheld]
}

export function withMedia(
  parts: ReadonlyMap<string, Uint8Array>,
  bytes: (part: string) => Uint8Array | undefined,
): ReadonlyMap<string, Uint8Array> {
  let next: Map<string, Uint8Array> | null = null
  for (const part of unheldPictures(parts)) {
    const held = bytes(part)
    if (held === undefined) continue
    next ??= new Map(parts)
    next.set(part, held)
  }
  return next ?? parts
}

export function unheldIcons(parts: ReadonlyMap<string, Uint8Array>): readonly IconRef[] {
  const icons = new Map<string, IconRef>()
  for (const part of unheldPictures(parts)) {
    const icon = iconOfPart(part)
    if (icon !== null) icons.set(iconParts(icon.name, icon.weight, icon.color).svg, icon)
  }
  return [...icons.values()]
}
