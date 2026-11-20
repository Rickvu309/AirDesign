import { insertChild } from "./child-order.js"
import type { MarkupElement } from "./element-span.js"
import { changedPart } from "./fill-host.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { paintAttribute } from "./paint-color.js"
import { requireMarkup } from "./part-markup.js"
import { isShapeTag, shapeById, shapeTags } from "./shape-tree.js"
import { markupChildren, type MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

export const maskUri = "{5E2A7C1D-9B4F-4C83-A6E0-3D8F1B2C7A94}"

export const maskNamespace = "https://airdesign.app/2026/mask"

const maskXml = `<a:ext uri="${maskUri}"><adm:mask xmlns:adm="${maskNamespace}"></adm:mask></a:ext>`

type Found = {
  readonly bytes: Uint8Array
  readonly children: MarkupChildren
  readonly properties: MarkupElement
  readonly list: MarkupElement | undefined
  readonly own: MarkupElement | undefined
}

export function ownMask(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  if (!isShapeTag(shape.kind)) return undefined
  const kind = shapeTags[shape.kind].properties
  const properties = kind === null ? undefined : children[shape.index]?.find((each) => each.kind === kind)
  const list =
    properties === undefined ? undefined : children[properties.index]?.find((each) => each.kind === "a:extLst")
  return list === undefined ? undefined : children[list.index]?.find((each) => paintAttribute(each, "uri") === maskUri)
}

export function maskElement(children: MarkupChildren, shape: MarkupElement): MarkupElement | undefined {
  const own = ownMask(children, shape)
  return own === undefined ? undefined : children[own.index]?.find((each) => each.kind === "adm:mask")
}

export function maskAt(children: MarkupChildren, shape: MarkupElement): boolean {
  return maskElement(children, shape) !== undefined
}

function found(parts: Parts, at: ElementAt): Found | null {
  const bytes = parts.get(at.part)
  if (bytes === undefined || at.shape === "slide") return null
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  let shape: MarkupElement
  try {
    shape = shapeById(elements, at.shape)
  } catch {
    return null
  }
  if (!isShapeTag(shape.kind) || shapeTags[shape.kind].properties !== "p:spPr") return null
  const properties = children[shape.index]?.find((each) => each.kind === "p:spPr")
  if (properties === undefined) return null
  const list = children[properties.index]?.find((each) => each.kind === "a:extLst")
  return { bytes, children, properties, list, own: ownMask(children, shape) }
}

export function shownMask(parts: Parts, at: ElementAt): boolean | null {
  const held = found(parts, at)
  if (held === null) return null
  return held.own !== undefined && (held.children[held.own.index]?.some((each) => each.kind === "adm:mask") ?? false)
}

export function maskWritten(parts: Parts, at: ElementAt, value: boolean): Parts {
  const held = found(parts, at)
  if (held === null) {
    if (!value) return parts
    throw new Error("mask-extension")
  }
  if (shownMask(parts, at) === value) return parts
  const { bytes, children, properties, list, own } = held
  if (!value) {
    if (own === undefined) return parts
    const only = list !== undefined && children[list.index]?.length === 1
    const gone = only ? list : own
    return changedPart(parts, at.part, bytes, { start: gone.start, end: gone.end, next: new Uint8Array() })
  }
  const next = encodeUtf8(maskXml)
  if (own !== undefined) return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  if (list !== undefined)
    return changedPart(parts, at.part, bytes, { start: list.closeStart, end: list.closeStart, next })
  const opened = properties.selfClosing
    ? "<p:spPr></p:spPr>"
    : decodeUtf8(bytes.subarray(properties.start, properties.end))
  const written = insertChild("p:spPr", "a:extLst", `<a:extLst>${maskXml}</a:extLst>`, opened)
  return changedPart(parts, at.part, bytes, { start: properties.start, end: properties.end, next: encodeUtf8(written) })
}
