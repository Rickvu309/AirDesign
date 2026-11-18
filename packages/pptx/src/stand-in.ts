import { clearedDrops, effectsNamespace, effectsUri, extensionDrops, type StoredDrop } from "./effects-extension.js"
import { changedPart } from "./fill-host.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { blipMarkup, declaresRelationships, linkedSource } from "./picture-write.js"
import { freeShapeId } from "./shape-id.js"
import { shapeBox, xmlAttribute, type ShapeBox } from "./shape-write.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import { colorXml } from "./color-xml.js"
import type { MarkupElement } from "./element-span.js"
import type { ElementAt, Parts } from "./xml-codec.js"

function digest(bytes: Uint8Array): string {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  return hash.toString(16).padStart(8, "0").repeat(8)
}

function shapeBoxOf(children: MarkupChildren, shape: MarkupElement): ShapeBox | null {
  if (!isShapeTag(shape.kind)) return null
  const kind = shapeTags[shape.kind].properties
  if (kind === null) return null
  const properties = children[shape.index]?.find((each) => each.kind === kind)
  const xfrm = properties === undefined ? undefined : children[properties.index]?.find((each) => each.kind === "a:xfrm")
  const off = xfrm === undefined ? undefined : children[xfrm.index]?.find((each) => each.kind === "a:off")
  const ext = xfrm === undefined ? undefined : children[xfrm.index]?.find((each) => each.kind === "a:ext")
  if (off === undefined || ext === undefined) return null
  const x = Number(paintAttribute(off, "x"))
  const y = Number(paintAttribute(off, "y"))
  const cx = Number(paintAttribute(ext, "cx"))
  const cy = Number(paintAttribute(ext, "cy"))
  if (![x, y, cx, cy].every((value) => Number.isInteger(value))) return null
  return { x, y, cx, cy }
}

export function paddedBox(box: ShapeBox, drops: readonly StoredDrop[]): ShapeBox {
  let pad = 0
  for (const drop of drops) pad = Math.max(pad, drop.blur + drop.distance)
  return { x: box.x - pad, y: box.y - pad, cx: box.cx + pad * 2, cy: box.cy + pad * 2 }
}

function shapeName(children: MarkupChildren, shape: MarkupElement, groupId: number): string {
  const kind = shape.kind
  if (!isShapeTag(kind)) return `Group ${groupId}`
  const visual = children[shape.index]?.find((each) => each.kind === shapeTags[kind].nonVisual)
  const named = visual === undefined ? undefined : children[visual.index]?.find((each) => each.kind === "p:cNvPr")
  const name = named === undefined ? null : paintAttribute(named, "name")
  return xmlAttribute(name === null || name === "" ? `Group ${groupId}` : name)
}

function pictureMarkup(id: string, blip: string, box: ShapeBox): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Picture ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill>${blip}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${shapeBox(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}

function markerXml(shape: string, picture: string, box: ShapeBox, drops: readonly StoredDrop[]): string {
  const entries = drops
    .map(
      (drop) =>
        `<adf:drop n="${drop.n}" blurRad="${drop.blur}" dist="${drop.distance}" dir="${drop.direction}">${colorXml(drop.color)}</adf:drop>`,
    )
    .join("")
  return `<a:extLst><a:ext uri="${effectsUri}"><adf:stand xmlns:adf="${effectsNamespace}" shape="${shape}" picture="${picture}" x="${box.x}" y="${box.y}" cx="${box.cx}" cy="${box.cy}">${entries}</adf:stand></a:ext></a:extLst>`
}

function groupMarkup(
  groupId: string,
  name: string,
  pictureId: string,
  blip: string,
  box: ShapeBox,
  shape: string,
  drops: readonly StoredDrop[],
  original: string,
): string {
  const xfrm = `<a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/><a:chOff x="${box.x}" y="${box.y}"/><a:chExt cx="${box.cx}" cy="${box.cy}"/></a:xfrm>`
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${groupId}" name="${name}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xfrm}${markerXml(shape, pictureId, box, drops)}</p:grpSpPr>${pictureMarkup(pictureId, blip, box)}${original}</p:grpSp>`
}

export function writtenStandIn(parts: Parts, at: ElementAt, png: Uint8Array): Parts {
  const drops = extensionDrops(parts, at)
  if (drops.length === 0) return parts
  const cleared = clearedDrops(parts, at)
  const bytes = partBytes(cleared, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  const box = shapeBoxOf(children, shape)
  if (box === null) throw new Error("effects-stand")
  const padded = paddedBox(box, drops)
  const pictureId = freeShapeId(cleared, at.part)
  const groupId = pictureId + 1
  const media = new Map(cleared)
  const linked = linkedSource(media, at.part, { media: { sha256: digest(png), type: "image/png" }, bytes: png })
  const blip = blipMarkup(linked, declaresRelationships(decodeUtf8(partBytes(media, at.part))))
  const group = groupMarkup(
    String(groupId),
    shapeName(children, shape, groupId),
    String(pictureId),
    blip,
    padded,
    at.shape,
    drops,
    decodeUtf8(bytes.subarray(shape.start, shape.end)),
  )
  return changedPart(media, at.part, partBytes(media, at.part), {
    start: shape.start,
    end: shape.end,
    next: encodeUtf8(group),
  })
}
