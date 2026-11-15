import { elementId, shapeOf, type FieldValue } from "@airdesign/document"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren } from "./text-value-route.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

export type End = FieldValue<"connection", "start">

type EndTag = "a:stCxn" | "a:endCxn"

const unbound: End = { none: true }
const ordered: readonly string[] = ["a:cxnSpLocks", "a:stCxn", "a:endCxn", "a:extLst"]

type Found = { readonly bytes: Uint8Array; readonly holder: MarkupElement; readonly held: readonly MarkupElement[] }

function holderOf(parts: Parts, at: ElementAt): Found | null {
  const bytes = parts.get(at.part)
  if (bytes === undefined) return null
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  if (shape.kind !== "p:cxnSp") return null
  const visual = children[shape.index]?.find((each) => each.kind === "p:nvCxnSpPr")
  const holder = visual === undefined ? undefined : children[visual.index]?.find((each) => each.kind === "p:cNvCxnSpPr")
  return holder === undefined ? null : { bytes, holder, held: children[holder.index] ?? [] }
}

function attributeOf(element: MarkupElement, name: string): string | null {
  return element.attributes.find((each) => each.name === name)?.value ?? null
}

export function endOf(slide: string, element: MarkupElement | undefined): End {
  const id = element === undefined ? null : attributeOf(element, "id")
  const site = element === undefined ? null : Number(attributeOf(element, "idx"))
  if (id === null || !/^[0-9]{1,10}$/.test(id) || site === null || !Number.isSafeInteger(site) || site < 0)
    return unbound
  return { shape: { node: elementId(`${slide}.${id}`), site } }
}

function shownEnd(tag: EndTag) {
  return (parts: Parts, at: ElementAt): End | null => {
    const found = holderOf(parts, at)
    return found === null
      ? null
      : endOf(
          at.slide,
          found.held.find((each) => each.kind === tag),
        )
  }
}

function endXml(tag: EndTag, slide: string, end: End): string {
  if ("none" in end) return ""
  const { slide: target, shape } = shapeOf(end.shape.node)
  if (target !== slide) throw new Error("connection-slide")
  return `<${tag} id="${shape}" idx="${String(end.shape.site)}"/>`
}

function writtenEnd(tag: EndTag) {
  return (parts: Parts, at: ElementAt, end: End): Parts => {
    const found = holderOf(parts, at)
    if (found === null) throw new Error("connection-shape")
    const { bytes, holder, held } = found
    const xml = encodeUtf8(endXml(tag, at.slide, end))
    const own = held.find((each) => each.kind === tag)
    const before = ordered.slice(0, ordered.indexOf(tag))
    let edit: ByteEdit
    if (own !== undefined) edit = { start: own.start, end: own.end, next: xml }
    else if (holder.selfClosing)
      edit = {
        start: holder.openEnd - 2,
        end: holder.openEnd,
        next: encodeUtf8(`>${endXml(tag, at.slide, end)}</p:cNvCxnSpPr>`),
      }
    else {
      const spot = held.reduce((after, each) => (before.includes(each.kind) ? each.end : after), holder.openEnd)
      edit = { start: spot, end: spot, next: xml }
    }
    const next = spliceBytes(bytes, [edit])
    if (sameBytes(next, partBytes(parts, at.part))) return parts
    const changed = new Map(parts)
    changed.set(at.part, next)
    return changed
  }
}

export function shownConnection(parts: Parts, at: ElementAt): { readonly start: End; readonly end: End } | null {
  const start = shownEnd("a:stCxn")(parts, at)
  const end = shownEnd("a:endCxn")(parts, at)
  return start === null || end === null ? null : { start, end }
}

export const connectionXml: TraitXml<"connection"> = {
  slot: null,
  fields: {
    start: whole({ read: shownEnd("a:stCxn"), write: writtenEnd("a:stCxn") }),
    end: whole({ read: shownEnd("a:endCxn"), write: writtenEnd("a:endCxn") }),
  },
}
