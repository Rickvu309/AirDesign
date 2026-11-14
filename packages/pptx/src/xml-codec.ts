import type { FieldEdit, FieldName, FieldValue, TraitName, TraitPatch } from "@airdesign/document"
import { childOrder, insertChild, type ChildOf, type OrderedParent } from "./child-order.js"
import { spliceBytes, type ByteEdit, type MarkupElement } from "./element-span.js"
import { inheritedSlot, slotAt } from "./inherited-slot.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import { markupChildren } from "./text-value-route.js"

export type Parts = ReadonlyMap<string, Uint8Array>

export type ElementAt = { readonly slide: string; readonly part: string; readonly shape: string }

export type AttributeCodec<V> = {
  readonly read: (text: string) => V | null
  readonly text: (value: V) => string
  readonly absent?: V
}

export type PartCodec<V> = {
  readonly read: (parts: Parts, at: ElementAt) => V | null
  readonly write: (parts: Parts, at: ElementAt, value: V) => Parts
}

export type Inherit = (parts: Parts, at: ElementAt) => Parts

export type FieldXml<V> =
  | { readonly at: "inner"; readonly tag: string | null; readonly name: string; readonly codec: AttributeCodec<V> }
  | { readonly at: "whole"; readonly codec: PartCodec<V>; readonly inherit: Inherit | null }

export type SlotXml = "transform"

export type TraitXml<T extends TraitName> = {
  readonly slot: SlotXml | null
  readonly fields: { readonly [F in FieldName<T>]-?: FieldXml<FieldValue<T, F>> }
}

export function inner<V>(tag: string, name: string, codec: AttributeCodec<V>): FieldXml<V> {
  return { at: "inner", tag, name, codec }
}

export function attribute<V>(name: string, codec: AttributeCodec<V>): FieldXml<V> {
  return { at: "inner", tag: null, name, codec }
}

export function whole<V>(codec: PartCodec<V>, inherit: Inherit | null = null): FieldXml<V> {
  return { at: "whole", codec, inherit }
}

export const emu: AttributeCodec<number> = {
  read: (text) => (Number.isInteger(Number(text)) ? Number(text) : null),
  text: (value) => {
    if (!Number.isInteger(value)) throw new Error("emu")
    return String(value)
  },
}

export const angle: AttributeCodec<number> = { ...emu, absent: 0 }

export const flag: AttributeCodec<boolean> = {
  read: (text) => (text === "1" || text === "true" ? true : text === "0" || text === "false" ? false : null),
  text: (value) => (value ? "1" : "0"),
  absent: false,
}

type InnerWrite = {
  readonly tag: string | null
  readonly name: string
  readonly text: string
  readonly shows: (text: string | null) => boolean
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (typeof value !== "object" || value === null) return value
  const entries = Object.entries(value).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return Object.fromEntries(entries.map(([key, item]) => [key, sorted(item)]))
}

function same(left: unknown, right: unknown): boolean {
  return left === right || JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function withPart(parts: Parts, part: string, bytes: Uint8Array): Parts {
  const next = new Map(parts)
  next.set(part, bytes)
  return next
}

function childOf(
  bytes: Uint8Array,
  tag: string,
): { readonly root: MarkupElement; readonly child?: MarkupElement; readonly children: readonly MarkupElement[] } {
  const { elements } = requireMarkup(bytes)
  const root = elements[0]
  if (root === undefined) throw new Error("slot")
  const children = markupChildren(elements)[root.index] ?? []
  const child = children.find((each) => each.kind === tag)
  return child === undefined ? { root, children } : { root, child, children }
}

function shownText(slot: Uint8Array | null, write: InnerWrite): string | null {
  if (slot === null) return null
  const held = write.tag === null ? childOf(slot, "").root : childOf(slot, write.tag).child
  return held?.attributes.find((attribute) => attribute.name === write.name)?.value ?? null
}

function openTag(bytes: Uint8Array, element: MarkupElement): string {
  return decodeUtf8(bytes.subarray(element.start, element.openEnd - 2)).trimEnd()
}

function attributeEdits(child: MarkupElement, writes: readonly InnerWrite[]): readonly ByteEdit[] {
  const edits: ByteEdit[] = []
  let added = ""
  for (const write of writes) {
    const attribute = child.attributes.find((each) => each.name === write.name)
    if (attribute === undefined) added += ` ${write.name}="${write.text}"`
    else edits.push({ start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(write.text) })
  }
  const at = child.openEnd - (child.selfClosing ? 2 : 1)
  return added === "" ? edits : [...edits, { start: at, end: at, next: encodeUtf8(added) }]
}

function childAdded(
  bytes: Uint8Array,
  tag: string,
  writes: readonly InnerWrite[],
  order: readonly string[],
): Uint8Array {
  const { root, children } = childOf(bytes, tag)
  const element = `<${tag}${writes.map((write) => ` ${write.name}="${write.text}"`).join("")}/>`
  if (root.selfClosing) {
    return spliceBytes(bytes, [
      { start: root.start, end: root.end, next: encodeUtf8(`${openTag(bytes, root)}>${element}</${root.kind}>`) },
    ])
  }
  const before = order.slice(0, order.indexOf(tag))
  const at = children.reduce((after, each) => (before.includes(each.kind) ? each.end : after), root.openEnd)
  return spliceBytes(bytes, [{ start: at, end: at, next: encodeUtf8(element) }])
}

function patchedSlot(slot: Uint8Array, writes: readonly InnerWrite[], order: readonly string[]): Uint8Array {
  let next = slot
  for (const tag of new Set(writes.map((write) => write.tag))) {
    const tagged = writes.filter((write) => write.tag === tag)
    if (tag === null) {
      next = spliceBytes(next, attributeEdits(childOf(next, "").root, tagged))
      continue
    }
    const { child } = childOf(next, tag)
    next = child === undefined ? childAdded(next, tag, tagged, order) : spliceBytes(next, attributeEdits(child, tagged))
  }
  return next
}

function hostWithSlot(bytes: Uint8Array, host: MarkupElement, tag: string, slot: Uint8Array): ByteEdit {
  const text = decodeUtf8(slot)
  if (host.selfClosing) {
    return { start: host.start, end: host.end, next: encodeUtf8(`${openTag(bytes, host)}>${text}</${host.kind}>`) }
  }
  if (!Object.hasOwn(childOrder, host.kind)) throw new Error(host.kind)
  const parent = host.kind as OrderedParent
  const child = tag as ChildOf<OrderedParent>
  const hostText = decodeUtf8(bytes.subarray(host.start, host.end))
  return { start: host.start, end: host.end, next: encodeUtf8(insertChild(parent, child, text, hostText)) }
}

function writeSlot(
  parts: Parts,
  at: ElementAt,
  slot: SlotXml | null,
  writes: readonly InnerWrite[],
  order: readonly string[],
): Parts {
  if (slot === null) throw new Error("slot")
  const bytes = partBytes(parts, at.part)
  const place = slotAt(bytes, at.shape, slot)
  const own = place.own === null ? null : bytes.subarray(place.own.start, place.own.end)
  const shown = own ?? inheritedSlot(parts, at, slot)
  const needed = writes.filter((write) => !write.shows(shownText(shown, write)))
  if (needed.length === 0) return parts
  const patched = patchedSlot(shown ?? encodeUtf8(`<${place.tag}/>`), needed, order)
  let edit: ByteEdit
  if (place.own !== null) edit = { start: place.own.start, end: place.own.end, next: patched }
  else if (place.host === null) throw new Error(place.hostTag)
  else edit = hostWithSlot(bytes, place.host, place.tag, patched)
  const next = spliceBytes(bytes, [edit])
  return sameBytes(next, bytes) ? parts : withPart(parts, at.part, next)
}

function innerWrite<V>(field: Extract<FieldXml<V>, { at: "inner" }>, value: V): InnerWrite {
  return {
    tag: field.tag,
    name: field.name,
    text: field.codec.text(value),
    shows: (text) => {
      const read = text === null ? (field.codec.absent ?? null) : field.codec.read(text)
      return read !== null && same(read, value)
    },
  }
}

export function writeFields<T extends TraitName>(
  parts: Parts,
  at: ElementAt,
  xml: TraitXml<T>,
  patch: TraitPatch<T>,
): Parts {
  const fields = Object.entries(xml.fields) as [string, FieldXml<unknown>][]
  const edits = patch as Readonly<Record<string, FieldEdit<unknown> | undefined>>
  const order = [
    ...new Set(fields.flatMap(([, field]) => (field.at === "inner" && field.tag !== null ? [field.tag] : []))),
  ]
  const writes: InnerWrite[] = []
  let next = parts
  for (const [name, field] of fields) {
    const edit = edits[name]
    if (edit === undefined || edit === "opening") continue
    if (edit === "inherit") {
      if (field.at === "inner" || field.inherit === null) throw new Error("inherit")
      next = field.inherit(next, at)
    } else if (field.at === "inner") writes.push(innerWrite(field, edit.set))
    else if (!same(field.codec.read(next, at), edit.set)) next = field.codec.write(next, at, edit.set)
  }
  return writes.length === 0 ? next : writeSlot(next, at, xml.slot, writes, order)
}
