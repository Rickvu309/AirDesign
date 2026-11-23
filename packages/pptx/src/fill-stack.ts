import { insertChild } from "./child-order.js"
import { fillMarkup, type Drawn } from "./fill-markup.js"
import { changedPart } from "./fill-host.js"
import { fillValueOf, type SlotFill } from "./fill-read.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { type MarkupElement } from "./element-span.js"
import { paintAttribute } from "./paint-color.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { stackNamespace, stackUri } from "./stack-extension.js"
import { markupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

type Found = {
  readonly bytes: Uint8Array
  readonly children: ReturnType<typeof markupChildren>
  readonly properties: MarkupElement
  readonly list: MarkupElement | undefined
  readonly own: MarkupElement | undefined
}

function found(parts: Parts, at: ElementAt): Found | null {
  if (at.shape === "slide") return null
  const bytes = partBytes(parts, at.part)
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  const properties = children[shape.index]?.find((each) => each.kind === "p:spPr")
  if (properties === undefined) return null
  const list = children[properties.index]?.find((each) => each.kind === "a:extLst")
  const own =
    list === undefined ? undefined : children[list.index]?.find((each) => paintAttribute(each, "uri") === stackUri)
  return { bytes, children, properties, list, own }
}

function entryXml(paint: SlotFill): string {
  if ("hidden" in paint) return `<adf:hidden>${entryXml(paint.hidden)}</adf:hidden>`
  return "image" in paint ? "<adf:image/>" : fillMarkup(paint as Drawn).xml
}

export function stackXml(paints: readonly SlotFill[], bake: boolean): string {
  const inner = paints.map(entryXml).join("")
  const baked = bake ? ' bake="1"' : ""
  return `<a:ext uri="${stackUri}"><adf:fills xmlns:adf="${stackNamespace}"${baked}>${inner}</adf:fills></a:ext>`
}

function entryOf(element: MarkupElement, children: ReturnType<typeof markupChildren>): SlotFill | null {
  if (element.kind === "adf:image") return { image: true }
  if (element.kind !== "adf:hidden") return fillValueOf({ element, children }, null)
  const inner = children[element.index]?.[0]
  const shown = inner === undefined ? null : entryOf(inner, children)
  return shown === null || "hidden" in shown ? null : ({ hidden: shown } as SlotFill)
}

export function shownStack(parts: Parts, at: ElementAt): readonly (SlotFill | null)[] | null {
  const held = found(parts, at)
  const list = held?.own === undefined ? undefined : held.children[held.own.index]?.[0]
  if (held === null || list === undefined) return null
  return (held.children[list.index] ?? []).map((element) => entryOf(element, held.children))
}

export function writtenStack(parts: Parts, at: ElementAt, paints: readonly SlotFill[] | null, bake = true): Parts {
  const held = found(parts, at)
  if (held === null) {
    if (paints === null) return parts
    throw new Error("fills-stack")
  }
  const { bytes, properties, list, own } = held
  const only = list !== undefined && held.children[list.index]?.length === 1
  if (paints === null) {
    const gone = only ? list : own
    return gone === undefined
      ? parts
      : changedPart(parts, at.part, bytes, { start: gone.start, end: gone.end, next: new Uint8Array() })
  }
  const next = encodeUtf8(stackXml(paints, bake))
  if (own !== undefined) return changedPart(parts, at.part, bytes, { start: own.start, end: own.end, next })
  if (list !== undefined)
    return changedPart(parts, at.part, bytes, { start: list.closeStart, end: list.closeStart, next })
  const parent = decodeUtf8(bytes.subarray(properties.start, properties.end))
  const written = insertChild("p:spPr", "a:extLst", `<a:extLst>${stackXml(paints, bake)}</a:extLst>`, parent)
  return changedPart(parts, at.part, bytes, { start: properties.start, end: properties.end, next: encodeUtf8(written) })
}
