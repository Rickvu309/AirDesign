import { markupDocument, spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import { maskElement } from "./mask-extension.js"
import {
  bakedElement,
  bakedOf,
  cropOf,
  geometryOf,
  nativeLook,
  placedOf,
  runDigest,
  siblingsOf,
  type Sibling,
} from "./mask-runs.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { blipMarkup, declaresRelationships, linkedSource } from "./picture-write.js"
import { freeShapeId } from "./shape-id.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { Parts } from "./xml-codec.js"

const full = 100_000

type Found = {
  readonly bytes: Uint8Array
  readonly children: MarkupChildren
  readonly run: readonly Sibling[]
}

function runOf(bytes: Uint8Array, mask: string): Found {
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, mask)
  const parent = elements[shape.parent]
  if (parent === undefined) throw new Error("mask-run")
  const siblings = siblingsOf(children, parent)
  const at = siblings.findIndex((each) => each.element.index === shape.index)
  let end = at + 1
  while (end < siblings.length && !(siblings[end]!.mask && !siblings[end]!.hidden)) end += 1
  return { bytes, children, run: siblings.slice(at, end) }
}

function text(bytes: Uint8Array, element: MarkupElement | undefined): string {
  return element === undefined ? "" : decodeUtf8(bytes.subarray(element.start, element.end))
}

function sideXml(name: string, value: number): string {
  const whole = Math.round(value * full)
  return whole === 0 ? "" : ` ${name}="${whole}"`
}

function nameOf(bytes: Uint8Array, identity: MarkupElement): string {
  const name = identity.attributes.find((each) => each.name === "name")
  return name === undefined ? "Mask group" : decodeUtf8(bytes.subarray(name.valueStart, name.valueEnd))
}

function pictureXml(id: number, name: string, fill: string, properties: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill>${fill}</p:blipFill><p:spPr>${properties}</p:spPr></p:pic>`
}

function xfrmOf(found: Found, shape: MarkupElement): string {
  const properties = found.children[shape.index]?.find((each) => each.kind === "p:spPr")
  return text(
    found.bytes,
    found.children[properties?.index ?? -1]?.find((each) => each.kind === "a:xfrm"),
  )
}

function nativeXml(found: Found, id: number): string {
  const [mask, picture] = [found.run[0]!, found.run.slice(1).find((each) => !each.hidden)!]
  const { bytes, children } = found
  const outline = placedOf(children, mask.element)!
  const placed = placedOf(children, picture.element)!
  const crop = cropOf(children, picture.element)
  const across = 1 - crop.l - crop.r
  const down = 1 - crop.t - crop.b
  const left = crop.l + ((outline.x - placed.x) / placed.cx) * across
  const right = 1 - (crop.l + ((outline.x + outline.cx - placed.x) / placed.cx) * across)
  const top = crop.t + ((outline.y - placed.y) / placed.cy) * down
  const bottom = 1 - (crop.t + ((outline.y + outline.cy - placed.y) / placed.cy) * down)
  const fill = children[picture.element.index]?.find((each) => each.kind === "p:blipFill")
  const blip = children[fill?.index ?? -1]?.find((each) => each.kind === "a:blip")
  const rect = `<a:srcRect${sideXml("l", left)}${sideXml("t", top)}${sideXml("r", right)}${sideXml("b", bottom)}/>`
  const properties = `${xfrmOf(found, mask.element)}${text(bytes, geometryOf(children, mask.element))}`
  return pictureXml(
    id,
    nameOf(bytes, picture.identity),
    `${text(bytes, blip)}${rect}<a:stretch><a:fillRect/></a:stretch>`,
    properties,
  )
}

function standXml(picture: string | null, hid: readonly string[], digest: string): string {
  const shown = picture === null ? "" : ` picture="${picture}"`
  return `<adm:stand${shown} hid="${hid.join(" ")}" digest="${digest}"/>`
}

function pictureId(markup: string): string | null {
  if (markup === "") return null
  return markupDocument(encodeUtf8(markup)).elements.find((each) => each.kind === "p:cNvPr")?.id ?? null
}

export function bakedMask(parts: Parts, part: string, mask: string, png: Uint8Array | null): Parts {
  const found = runOf(partBytes(parts, part), mask)
  const { bytes, children, run } = found
  const head = run[0]
  if (head === undefined) throw new Error("mask-run")
  const masked = run.slice(1).filter((each) => !each.hidden)
  const digest = runDigest(bytes, children, run)
  const cached = bakedOf(bytes, children, head.element)
  const next = new Map(parts)
  let markup: string
  if (cached !== null && cached.digest === digest) markup = cached.markup
  else if (masked.length === 0) markup = ""
  else if (nativeLook(children, head, masked)) markup = nativeXml(found, freeShapeId(parts, part))
  else {
    if (png === null) throw new Error("mask-picture")
    const linked = linkedSource(next, part, { media: { sha256: digestHex(png), type: "image/png" }, bytes: png })
    const blip = blipMarkup(linked, declaresRelationships(decodeUtf8(bytes)))
    markup = pictureXml(
      freeShapeId(parts, part),
      nameOf(bytes, head.identity),
      `${blip}<a:stretch><a:fillRect/></a:stretch>`,
      `${xfrmOf(found, head.element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`,
    )
  }
  const hid = [head, ...masked]
  const edits: ByteEdit[] = hid.flatMap((each) => {
    const edit = attributeEdit(bytes, each.identity, "hidden", "1")
    return edit === null ? [] : [edit]
  })
  const stand = encodeUtf8(
    standXml(
      pictureId(markup),
      hid.map((each) => each.id),
      digest,
    ),
  )
  const baked = bakedElement(children, head.element)
  const root = maskElement(children, head.element)
  if (baked !== undefined) edits.push({ start: baked.start, end: baked.end, next: stand })
  else if (root !== undefined && !root.selfClosing)
    edits.push({ start: root.closeStart, end: root.closeStart, next: stand })
  else throw new Error("mask-run")
  const last = run[run.length - 1]!.element
  if (markup !== "") edits.push({ start: last.end, end: last.end, next: encodeUtf8(markup) })
  next.set(part, spliceBytes(bytes, edits))
  return next
}

function digestHex(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  return hash.toString(16).padStart(8, "0").repeat(8)
}
