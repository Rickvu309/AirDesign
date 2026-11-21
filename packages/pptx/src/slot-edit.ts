import { insertChild, type ChildOf, type OrderedParent } from "./child-order.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { requireMarkup } from "./part-markup.js"

export type Slot = (slot: Uint8Array) => Uint8Array

export function slotRoot(bytes: Uint8Array): MarkupElement {
  const root = requireMarkup(bytes).elements[0]
  if (root === undefined) throw new Error("slot")
  return root
}

export function openTag(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - (element.selfClosing ? 2 : 1))).trimEnd()
}

export function withAttributes(pairs: readonly (readonly [string, string | null])[]): Slot {
  return (slot) => {
    const root = slotRoot(slot)
    const edits: ByteEdit[] = []
    let appended = ""
    for (const [name, text] of pairs) {
      const at = root.attributes.findIndex((each) => each.name === name)
      const attribute = root.attributes[at]
      if (attribute === undefined) {
        if (text !== null) appended += ` ${name}="${text}"`
        continue
      }
      if (text !== null) {
        edits.push({ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(text) })
        continue
      }
      const before = root.attributes[at - 1]
      const start = before === undefined ? root.start + 1 + root.kind.length : before.valueEnd + 1
      edits.push({ start, end: attribute.valueEnd + 1, next: new Uint8Array() })
    }
    if (appended !== "") {
      const end = root.openEnd - (root.selfClosing ? 2 : 1)
      edits.push({ start: end, end, next: encodeUtf8(appended) })
    }
    return edits.length === 0 ? slot : spliceBytes(slot, edits)
  }
}

export function withAttribute(name: string, text: string | null): Slot {
  return withAttributes([[name, text]])
}

export function withChild<P extends OrderedParent>(
  parent: P,
  tags: readonly string[],
  tag: ChildOf<P> | null,
  element: string | null,
): Slot {
  return (slot) => {
    const { elements } = requireMarkup(slot)
    const root = slotRoot(slot)
    const gone: ByteEdit[] = elements
      .filter((each) => each.parent === root.index && tags.includes(each.kind))
      .map((each) => ({ start: each.start, end: each.end, next: new Uint8Array() }))
    const kept = gone.length === 0 ? slot : spliceBytes(slot, gone)
    if (tag === null || element === null) return kept
    const held = slotRoot(kept)
    if (held.selfClosing) return encodeUtf8(`${openTag(kept, held)}>${element}</${parent}>`)
    return encodeUtf8(insertChild(parent, tag, element, decodeUtf8(kept)))
  }
}

export function inTurn(...slots: readonly Slot[]): Slot {
  return (slot) => slots.reduce((next, each) => each(next), slot)
}
