import type { FieldValue } from "@airdesign/document"
import { embedded, fillWritten, linkTarget, pictureAt, type PictureFill } from "./blip-edit.js"
import { spliceBytes, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { picturePlacement, placementXml } from "./picture-placement.js"
import { rasterDimensions } from "./raster-dimensions.js"
import { requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeTags } from "./shape-tree.js"
import { markupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Mode = FieldValue<"fills", "mode">

export function shownPictureMode(parts: Parts, at: ElementAt): Mode | null {
  const found = pictureAt(parts, at)
  if (found === null) return null
  const inside = found.children[found.fill.index] ?? []
  if (inside.some((item) => item.kind === "a:tile")) return "tile"
  if (inside.some((item) => item.kind === "a:srcRect")) return "crop"
  const stretch = inside.find((item) => item.kind === "a:stretch")
  const rect =
    stretch === undefined ? undefined : found.children[stretch.index]?.find((item) => item.kind === "a:fillRect")
  if (rect === undefined) return "stretch"
  const sides = ["l", "t", "r", "b"].map((name) => Number(paintAttribute(rect, name) ?? 0))
  if (sides.some((side) => side < 0)) return "fill"
  if (sides.some((side) => side > 0)) return "fit"
  return rect.attributes.some((attribute) => attribute.name === "l")
    ? "fill"
    : rect.attributes.some((attribute) => attribute.name === "t")
      ? "fit"
      : "stretch"
}

export function writtenPictureMode(parts: Parts, at: ElementAt, mode: Mode): Parts {
  const found = pictureAt(parts, at)
  if (found === null) return parts
  let placement = "<a:stretch><a:fillRect/></a:stretch>"
  if (mode === "tile") placement = '<a:tile tx="0" ty="0" sx="100000" sy="100000" algn="tl"/>'
  if (mode === "fill" || mode === "fit") {
    const id = found.blip === undefined ? null : embedded(found.blip)
    const target = id === null ? null : linkTarget(parts, at.part, id)
    const bytes = target === null ? undefined : parts.get(target)
    const image = bytes === undefined ? null : rasterDimensions(bytes)
    const host = found.elements.find(
      (item) =>
        (item.kind === "p:pic" || item.kind === "p:sp") && item.start < found.fill.start && item.end >= found.fill.end,
    )
    const props = host === undefined ? undefined : found.children[host.index]?.find((item) => item.kind === "p:spPr")
    const transform =
      props === undefined ? undefined : found.children[props.index]?.find((item) => item.kind === "a:xfrm")
    const ext =
      transform === undefined ? undefined : found.children[transform.index]?.find((item) => item.kind === "a:ext")
    const box = {
      width: Number(ext === undefined ? 0 : paintAttribute(ext, "cx")),
      height: Number(ext === undefined ? 0 : paintAttribute(ext, "cy")),
    }
    if (image === null || box.width <= 0 || box.height <= 0) throw new Error("picture-dimensions")
    placement = placementXml(mode, image, box)
  }
  return fillWritten(parts, at, (current) => {
    if (current.fill.selfClosing) throw new Error("picture-fill")
    const inside = current.children[current.fill.index] ?? []
    const crop = inside.find((item) => item.kind === "a:srcRect")
    const kept = inside
      .filter((item) => !["a:stretch", "a:tile", "a:srcRect"].includes(item.kind))
      .map((item) => decodeUtf8(current.bytes.subarray(item.start, item.end)))
      .join("")
    const rect =
      mode === "crop"
        ? crop === undefined
          ? "<a:srcRect/>"
          : decodeUtf8(current.bytes.subarray(crop.start, crop.end))
        : ""
    return spliceBytes(current.bytes, [
      {
        start: current.fill.openEnd,
        end: current.fill.end - `</${current.fill.kind}>`.length,
        next: encodeUtf8(`${kept}${rect}${placement}`),
      },
    ])
  })
}

export function coverOnResize(before: Parts, after: Parts, at: ElementAt): Parts {
  const was = before.get(at.part)
  const now = after.get(at.part)
  if (was === undefined || now === undefined || extentText(was, at.shape) === extentText(now, at.shape)) return after
  const shape = shapeOf(requireMarkup(now).elements, at.shape)
  if (shape === null) return after
  return shape.kind === "p:grpSp" ? coverInside(after, at) : coverOne(after, at)
}

function extentText(bytes: Uint8Array, id: string): string | null {
  const { elements } = requireMarkup(bytes)
  const shape = shapeOf(elements, id)
  if (shape === null || !isShapeTag(shape.kind)) return null
  const properties = shapeTags[shape.kind].properties
  if (properties === null) return null
  const children = markupChildren(elements)
  const host = children[shape.index]?.find((item) => item.kind === properties)
  const transform = host === undefined ? undefined : children[host.index]?.find((item) => item.kind === "a:xfrm")
  const ext = transform === undefined ? undefined : children[transform.index]?.find((item) => item.kind === "a:ext")
  return ext === undefined ? null : decodeUtf8(bytes.subarray(ext.start, ext.end))
}

function shapeOf(elements: readonly MarkupElement[], id: string): MarkupElement | null {
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id !== id) continue
    let parent = mark.parent
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) return null
      if (isShapeTag(ancestor.kind)) return ancestor
      parent = ancestor.parent
    }
  }
  return null
}

function coverInside(parts: Parts, at: ElementAt): Parts {
  const bytes = parts.get(at.part)
  if (bytes === undefined) return parts
  const elements = requireMarkup(bytes).elements
  const group = shapeOf(elements, at.shape)
  if (group === null) return parts
  let next = parts
  for (const id of pictureIds(elements, group)) next = coverOne(next, { ...at, shape: id })
  return next
}

function pictureIds(elements: readonly MarkupElement[], group: MarkupElement): readonly string[] {
  const ids: string[] = []
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id === null) continue
    let parent = mark.parent
    let shape: MarkupElement | null = null
    let inside = false
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (shape === null && isShapeTag(ancestor.kind)) shape = ancestor
      if (ancestor.index === group.index) inside = true
      parent = ancestor.parent
    }
    if (inside && shape !== null && (shape.kind === "p:pic" || shape.kind === "p:sp")) ids.push(mark.id)
  }
  return ids
}

function coverOne(parts: Parts, at: ElementAt): Parts {
  const found = pictureAt(parts, at)
  if (found === null || shownPictureMode(parts, at) !== "fill") return parts
  const image = imageOf(parts, at, found)
  const box = shownBox(found)
  if (image === null || box === null) return parts
  const placed = picturePlacement("fill", image, box)
  const rect = fillRectOf(found)
  if (rect === null || sameSides(rect, placed)) return parts
  const next = spliceBytes(found.bytes, [
    {
      start: rect.start,
      end: rect.end,
      next: encodeUtf8(`<a:fillRect l="${placed.l}" t="${placed.t}" r="${placed.r}" b="${placed.b}"/>`),
    },
  ])
  if (sameBytes(next, found.bytes)) return parts
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}

function imageOf(parts: Parts, at: ElementAt, found: PictureFill): { width: number; height: number } | null {
  const id = found.blip === undefined ? null : embedded(found.blip)
  const target = id === null ? null : linkTarget(parts, at.part, id)
  const bytes = target === null ? undefined : parts.get(target)
  if (bytes === undefined) return null
  const image = rasterDimensions(bytes)
  return image === null || image.width <= 0 || image.height <= 0 ? null : image
}

function shownBox(found: PictureFill): { width: number; height: number } | null {
  const host = found.elements.find(
    (item) =>
      (item.kind === "p:pic" || item.kind === "p:sp") && item.start < found.fill.start && item.end >= found.fill.end,
  )
  if (host === undefined) return null
  const local = extentOf(found, host)
  if (local === null || local.width <= 0 || local.height <= 0) return null
  let width = local.width
  let height = local.height
  let parent = host.parent
  while (parent >= 0) {
    const ancestor = found.elements[parent]
    if (ancestor === undefined) break
    if (ancestor.kind === "p:grpSp") {
      const scale = scaleOf(found, ancestor)
      if (scale === null) return null
      width *= scale.x
      height *= scale.y
    }
    parent = ancestor.parent
  }
  return width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null
}

function extentOf(found: PictureFill, shape: MarkupElement): { width: number; height: number } | null {
  const props = member(found, shape, "p:spPr")
  const transform = props === undefined ? undefined : member(found, props, "a:xfrm")
  const ext = transform === undefined ? undefined : member(found, transform, "a:ext")
  if (ext === undefined) return null
  const width = Number(paintAttribute(ext, "cx"))
  const height = Number(paintAttribute(ext, "cy"))
  return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null
}

function scaleOf(found: PictureFill, group: MarkupElement): { x: number; y: number } | null {
  const props = member(found, group, "p:grpSpPr")
  const transform = props === undefined ? undefined : member(found, props, "a:xfrm")
  if (transform === undefined) return null
  const ext = member(found, transform, "a:ext")
  const childExt = member(found, transform, "a:chExt")
  if (ext === undefined || childExt === undefined) return null
  const width = Number(paintAttribute(ext, "cx"))
  const height = Number(paintAttribute(ext, "cy"))
  const childWidth = Number(paintAttribute(childExt, "cx"))
  const childHeight = Number(paintAttribute(childExt, "cy"))
  if (![width, height, childWidth, childHeight].every((value) => Number.isFinite(value))) return null
  return { x: childWidth === 0 ? 1 : width / childWidth, y: childHeight === 0 ? 1 : height / childHeight }
}

function member(found: PictureFill, parent: MarkupElement, kind: string): MarkupElement | undefined {
  return found.children[parent.index]?.find((item) => item.kind === kind)
}

function fillRectOf(found: PictureFill): MarkupElement | null {
  const inside = found.children[found.fill.index] ?? []
  const stretch = inside.find((item) => item.kind === "a:stretch")
  if (stretch === undefined) return null
  return found.children[stretch.index]?.find((item) => item.kind === "a:fillRect") ?? null
}

function sameSides(rect: MarkupElement, placed: { l: number; t: number; r: number; b: number }): boolean {
  const side = (name: "l" | "t" | "r" | "b") => Number(paintAttribute(rect, name) ?? 0)
  return side("l") === placed.l && side("t") === placed.t && side("r") === placed.r && side("b") === placed.b
}
