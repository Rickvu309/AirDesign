import type { FieldValue } from "@airdesign/document"
import { embedded, fillWritten, linkTarget, pictureAt } from "./blip-edit.js"
import { spliceBytes } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { rasterDimensions } from "./raster-dimensions.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Mode = FieldValue<"fills", "mode">
type Size = { width: number; height: number }

export function picturePlacement(mode: "fill" | "fit", image: Size, box: Size) {
  const scale = Math[mode === "fill" ? "max" : "min"](box.width / image.width, box.height / image.height)
  const l = Math.round((1 - (image.width * scale) / box.width) * 50000)
  const t = Math.round((1 - (image.height * scale) / box.height) * 50000)
  return { l: l === 0 ? 0 : l, t: t === 0 ? 0 : t, r: l === 0 ? 0 : l, b: t === 0 ? 0 : t }
}

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
    const rect = picturePlacement(mode, image, box)
    placement =
      mode === "fit" && rect.l === 0
        ? `<a:stretch><a:fillRect t="${rect.t}" b="${rect.b}"/></a:stretch>`
        : `<a:stretch><a:fillRect l="${rect.l}" t="${rect.t}" r="${rect.r}" b="${rect.b}"/></a:stretch>`
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
