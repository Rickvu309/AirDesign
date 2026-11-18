import { insertChild } from "./child-order.js"
import { fillKinds } from "./color-read.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import type { Written } from "./fill-markup.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export type FillHost = "sp" | "pic" | "bg"

export function hostOf(parts: Parts, at: ElementAt): FillHost {
  if (at.shape === "slide") return "bg"
  return shapeById(requireMarkup(partBytes(parts, at.part)).elements, at.shape).kind === "p:pic" ? "pic" : "sp"
}

export function changedPart(parts: Parts, part: string, bytes: Uint8Array, edit: ByteEdit | null): Parts {
  if (edit === null) return parts
  const next = spliceBytes(bytes, [edit])
  if (sameBytes(next, bytes)) return parts
  const changed = new Map(parts)
  changed.set(part, next)
  return changed
}

function writtenBackground(parts: Parts, at: ElementAt, written: Written | null): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const root = elements.find((element) => element.parent < 0)
  const body = elements.find((element) => element.kind === "p:cSld" && element.parent === root?.index)
  if (body === undefined || body.selfClosing) throw new Error("p:cSld")
  const own = elements.find((element) => element.kind === "p:bg" && element.parent === body.index)
  const next = encodeUtf8(written === null ? "" : `<p:bg><p:bgPr>${written.xml}<a:effectLst/></p:bgPr></p:bg>`)
  if (own !== undefined) return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  return written === null ? parts : changedPart(parts, at.part, bytes, { start: body.openEnd, end: body.openEnd, next })
}

export function writtenFill(parts: Parts, at: ElementAt, written: Written | null): Parts {
  if (at.shape === "slide") return writtenBackground(parts, at, written)
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, at.shape)
  if (shape.kind !== "p:sp" && shape.kind !== "p:pic") throw new Error("fill-shape")
  const properties = elements.filter((item) => item.parent === shape.index && item.kind === "p:spPr")
  const spPr = properties[0]
  if (properties.length !== 1 || spPr === undefined) throw new Error("fill-properties")
  const fills = elements.filter((item) => item.parent === spPr.index && fillKinds.has(item.kind))
  const fill = fills[0]
  if (fills.length > 1) throw new Error("fill-choice")
  let edit: ByteEdit | null = null
  if (fill !== undefined) edit = { start: fill.start, end: fill.end, next: encodeUtf8(written?.xml ?? "") }
  else if (written !== null && spPr.selfClosing)
    edit = { start: spPr.openEnd - 2, end: spPr.openEnd, next: encodeUtf8(`>${written.xml}</p:spPr>`) }
  else if (written !== null) {
    const parent = decodeUtf8(bytes.subarray(spPr.start, spPr.end))
    edit = {
      start: spPr.start,
      end: spPr.end,
      next: encodeUtf8(insertChild("p:spPr", written.tag, written.xml, parent)),
    }
  }
  return changedPart(parts, at.part, bytes, edit)
}

export function ownFill(bytes: Uint8Array, at: ElementAt): MarkupElement | undefined {
  const { elements } = requireMarkup(bytes)
  const inside = (parent: MarkupElement | undefined, kind: string) =>
    parent === undefined ? undefined : elements.find((each) => each.parent === parent.index && each.kind === kind)
  let host: MarkupElement | undefined
  if (at.shape === "slide") {
    const root = elements.find((element) => element.parent < 0)
    host = inside(inside(inside(root, "p:cSld"), "p:bg"), "p:bgPr")
  } else host = inside(shapeById(elements, at.shape), "p:spPr")
  return host === undefined
    ? undefined
    : elements.find((each) => each.parent === host.index && fillKinds.has(each.kind))
}

export function pictureAsShape(parts: Parts, at: ElementAt): Parts {
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const picture = shapeById(elements, at.shape)
  if (picture.kind !== "p:pic") return parts
  const childOf = (parent: MarkupElement | undefined, kind: string) =>
    parent === undefined ? undefined : elements.find((each) => each.parent === parent.index && each.kind === kind)
  const text = (element: MarkupElement | undefined) =>
    element === undefined ? "" : decodeUtf8(bytes.subarray(element.start, element.end))
  const named = childOf(picture, "p:nvPicPr")
  const identity = childOf(named, "p:cNvPr")
  const properties = childOf(picture, "p:spPr")
  if (identity === undefined || properties === undefined) throw new Error("p:pic")
  const nonVisual = childOf(named, "p:nvPr")
  const shape =
    `<p:sp><p:nvSpPr>${text(identity)}<p:cNvSpPr/>${nonVisual === undefined ? "<p:nvPr/>" : text(nonVisual)}</p:nvSpPr>` +
    `${text(properties)}${text(childOf(picture, "p:style"))}${text(childOf(picture, "p:extLst"))}</p:sp>`
  return changedPart(parts, at.part, bytes, { start: picture.start, end: picture.end, next: encodeUtf8(shape) })
}
