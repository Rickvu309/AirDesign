import { decodedXmlText, spliceBytes, type MarkupElement } from "./element-span.js"
import { partOf, relsOf } from "./package-address.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { declaresRelationships, relationshipsAttribute, svgExtension } from "./picture-write.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export type PictureFill = {
  readonly bytes: Uint8Array
  readonly elements: readonly MarkupElement[]
  readonly children: MarkupChildren
  readonly fill: MarkupElement
  readonly blip: MarkupElement | undefined
}

export type BlipPieces = {
  readonly open: Uint8Array
  readonly effects: readonly { readonly kind: string; readonly xml: string }[]
  readonly exts: readonly { readonly uri: string | null; readonly xml: string }[]
}

function attributeOf(element: MarkupElement, name: string): string | null {
  const found = element.attributes.find((each) => each.name === name)
  return found === undefined ? null : decodedXmlText(found.value)
}

export function pictureFill(bytes: Uint8Array, shape: string): PictureFill | null {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  if (!elements.some((each) => each.kind === "p:cNvPr" && each.id === shape)) return null
  const element = shapeById(elements, shape)
  const props = children[element.index]?.find((each) => each.kind === "p:spPr")
  const fill =
    element.kind === "p:pic"
      ? children[element.index]?.find((each) => each.kind === "p:blipFill")
      : element.kind === "p:sp"
        ? children[props?.index ?? -1]?.find((each) => each.kind === "a:blipFill")
        : undefined
  if (fill === undefined) return null
  const blip = children[fill.index]?.find((each) => each.kind === "a:blip")
  return { bytes, elements, children, fill, blip }
}

export function pictureAt(parts: Parts, at: ElementAt): PictureFill | null {
  const bytes = parts.get(at.part)
  return bytes === undefined ? null : pictureFill(bytes, at.shape)
}

export function linkTarget(parts: Parts, part: string, id: string): string | null {
  const rels = parts.get(relsOf(part))
  if (rels === undefined) return null
  const row = requireMarkup(rels).elements.find(
    (element) => element.kind === "Relationship" && attributeOf(element, "Id") === id,
  )
  if (row === undefined || attributeOf(row, "TargetMode") === "External") return null
  const target = attributeOf(row, "Target")
  return target === null ? null : partOf(part, target)
}

function text(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.end))
}

export function blipPieces(found: PictureFill, blip: MarkupElement): BlipPieces {
  const { bytes, children } = found
  const inside = children[blip.index] ?? []
  const list = inside.find((each) => each.kind === "a:extLst")
  const exts = (list === undefined ? [] : (children[list.index] ?? [])).map((each) => ({
    uri: attributeOf(each, "uri"),
    xml: text(bytes, each),
  }))
  const effects = inside
    .filter((each) => each.kind !== "a:extLst")
    .map((each) => ({ kind: each.kind, xml: text(bytes, each) }))
  return { open: bytes.subarray(blip.start, blip.openEnd - (blip.selfClosing ? 2 : 1)), effects, exts }
}

export function blipXml(pieces: BlipPieces): string {
  const open = decodeUtf8(pieces.open).trimEnd()
  const list = pieces.exts.length === 0 ? "" : `<a:extLst>${pieces.exts.map((each) => each.xml).join("")}</a:extLst>`
  const inner = `${pieces.effects.map((each) => each.xml).join("")}${list}`
  return inner === "" ? `${open}/>` : `${open}>${inner}</a:blip>`
}

export function svgEmbed(children: MarkupChildren, blip: MarkupElement): string | null {
  const list = children[blip.index]?.find((each) => each.kind === "a:extLst")
  const ext = (list === undefined ? [] : (children[list.index] ?? [])).find(
    (each) => attributeOf(each, "uri") === svgExtension,
  )
  const svg = ext === undefined ? undefined : children[ext.index]?.find((each) => each.kind === "asvg:svgBlip")
  return svg === undefined ? null : attributeOf(svg, "r:embed")
}

export function embedded(blip: MarkupElement): string | null {
  return attributeOf(blip, "r:embed")
}

export function withEmbed(found: PictureFill, blip: MarkupElement, embed: string, declared: boolean): Uint8Array {
  const attribute = blip.attributes.find((each) => each.name === "r:embed")
  const open = found.bytes.subarray(blip.start, blip.openEnd - (blip.selfClosing ? 2 : 1))
  if (attribute !== undefined)
    return spliceBytes(open, [
      { start: attribute.valueStart - blip.start, end: attribute.valueEnd - blip.start, next: encodeUtf8(embed) },
    ])
  const trimmed = decodeUtf8(open).trimEnd()
  return encodeUtf8(`${trimmed}${relationshipsAttribute(declared)} r:embed="${embed}"`)
}

export function partDeclares(bytes: Uint8Array): boolean {
  return declaresRelationships(decodeUtf8(bytes))
}

export function blipWritten(
  parts: Parts,
  at: ElementAt,
  change: (found: PictureFill, blip: MarkupElement) => string,
): Parts {
  const bytes = partBytes(parts, at.part)
  const found = pictureFill(bytes, at.shape)
  if (found === null) throw new Error("p:blipFill")
  const blip = found.blip
  if (blip === undefined) throw new Error("a:blip")
  const next = spliceBytes(bytes, [{ start: blip.start, end: blip.end, next: encodeUtf8(change(found, blip)) }])
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}

export function fillWritten(parts: Parts, at: ElementAt, change: (found: PictureFill) => Uint8Array): Parts {
  const bytes = partBytes(parts, at.part)
  const found = pictureFill(bytes, at.shape)
  if (found === null) throw new Error("p:blipFill")
  const next = change(found)
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}
