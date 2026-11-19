import { spliceBytes } from "./element-span.js"
import { attributeEdit } from "./markup-attribute.js"
import type { MarkupElement } from "./markup-reader.js"
import { encodeUtf8 } from "./package-bytes.js"
import { partBytes, requireMarkup } from "./part-markup.js"
import type { MarkupChildren } from "./text-value-route.js"
import type { ElementAt, Parts } from "./xml-codec.js"

const locksOf: Readonly<Record<string, string>> = {
  "p:cNvSpPr": "a:spLocks",
  "p:cNvPicPr": "a:picLocks",
  "p:cNvCxnSpPr": "a:cxnSpLocks",
  "p:cNvGrpSpPr": "a:grpSpLocks",
  "p:cNvGraphicFramePr": "a:graphicFrameLocks",
}

const turnless = new Set(["a:graphicFrameLocks"])

type Found = { readonly holder: MarkupElement; readonly tag: string; readonly locks: MarkupElement | undefined }

function holderOf(elements: readonly MarkupElement[], identity: MarkupElement): Found | null {
  const holder = elements.find((each) => each.parent === identity.parent && locksOf[each.kind] !== undefined)
  const tag = holder === undefined ? undefined : locksOf[holder.kind]
  if (holder === undefined || tag === undefined) return null
  return { holder, tag, locks: elements.find((each) => each.parent === holder.index && each.kind === tag) }
}

function found(bytes: Uint8Array, shape: string): Found | null {
  const { elements } = requireMarkup(bytes)
  const identity = elements.find((each) => each.kind === "p:cNvPr" && each.id === shape)
  return identity === undefined ? null : holderOf(elements, identity)
}

export function lockedAt(children: MarkupChildren, identity: MarkupElement): boolean {
  const holder = children[identity.parent]?.find((each) => locksOf[each.kind] !== undefined)
  const tag = holder === undefined ? undefined : locksOf[holder.kind]
  if (holder === undefined || tag === undefined) return false
  return isOn(
    children[holder.index]?.find((each) => each.kind === tag),
    "noMove",
  )
}

function flagsOf(tag: string): readonly string[] {
  return turnless.has(tag) ? ["noMove", "noResize"] : ["noMove", "noResize", "noRot"]
}

function isOn(element: MarkupElement | undefined, name: string): boolean {
  const value = element?.attributes.find((each) => each.name === name)?.value
  return value === "1" || value === "true"
}

export function shownLocked(parts: Parts, at: ElementAt): boolean | null {
  const bytes = parts.get(at.part)
  const shape = bytes === undefined ? null : found(bytes, at.shape)
  return shape === null ? null : isOn(shape.locks, "noMove")
}

function added(bytes: Uint8Array, shape: Found): Uint8Array {
  const locks = encodeUtf8(
    `<${shape.tag} ${flagsOf(shape.tag)
      .map((flag) => `${flag}="1"`)
      .join(" ")}/>`,
  )
  const { holder } = shape
  if (!holder.selfClosing) return spliceBytes(bytes, [{ start: holder.openEnd, end: holder.openEnd, next: locks }])
  const close = encodeUtf8(`</${holder.kind}>`)
  const next = new Uint8Array(1 + locks.length + close.length)
  next.set(encodeUtf8(">"), 0)
  next.set(locks, 1)
  next.set(close, 1 + locks.length)
  return spliceBytes(bytes, [{ start: holder.openEnd - 2, end: holder.openEnd, next }])
}

function flagged(bytes: Uint8Array, shapeId: string, locked: boolean): Uint8Array {
  let next = bytes
  const shape = found(next, shapeId)
  if (shape === null) throw new Error("p:cNvPr")
  for (const flag of flagsOf(shape.tag)) {
    const locks = found(next, shapeId)?.locks
    if (locks === undefined) throw new Error(shape.tag)
    const edit = attributeEdit(next, locks, flag, locked ? "1" : null)
    if (edit !== null) next = spliceBytes(next, [edit])
  }
  return next
}

export function lockedWritten(parts: Parts, at: ElementAt, locked: boolean): Parts {
  const bytes = partBytes(parts, at.part)
  const shape = found(bytes, at.shape)
  if (shape === null) throw new Error("p:cNvPr")
  if (isOn(shape.locks, "noMove") === locked && flagsOf(shape.tag).every((flag) => isOn(shape.locks, flag) === locked))
    return parts
  if (shape.locks === undefined && !locked) return parts
  const next = shape.locks === undefined ? added(bytes, shape) : flagged(bytes, at.shape, locked)
  const changed = new Map(parts)
  changed.set(at.part, next)
  return changed
}
