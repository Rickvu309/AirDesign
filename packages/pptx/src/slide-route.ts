import type { TextValue } from "@airdesign/document"
import { insertChild } from "./child-order.js"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { addTextShape } from "./shape-write.js"
import {
  markupChildren,
  retypedOneRun,
  shapeTextValue,
  textValueEdits,
  type MarkupChildren,
} from "./text-value-route.js"

export type SlideRoute =
  | { readonly name: "text"; readonly part: string; readonly shape: string; readonly value: TextValue }
  | { readonly name: "move"; readonly part: string; readonly shape: string; readonly x: number; readonly y: number }
  | { readonly name: "resize"; readonly part: string; readonly shape: string; readonly cx: number; readonly cy: number }
  | {
      readonly name: "add"
      readonly part: string
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "remove"; readonly part: string; readonly shape: string }

const shapeKinds = new Set(["p:sp", "p:pic", "p:graphicFrame", "p:cxnSp", "p:grpSp"])
const emptyBytes = new Uint8Array(0)

function emu(value: number): number {
  if (!Number.isInteger(value)) throw new Error("emu")
  return value
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function requireMarkup(bytes: Uint8Array): MarkupDocument {
  const document = markupDocument(bytes)
  if (!document.wellFormed) throw new Error("xml")
  return document
}

export function shapeById(elements: readonly MarkupElement[], id: string): MarkupElement {
  for (const mark of elements) {
    if (mark.kind !== "p:cNvPr" || mark.id !== id) continue
    let parent = mark.parent
    while (parent >= 0) {
      const ancestor = elements[parent]
      if (ancestor === undefined) break
      if (shapeKinds.has(ancestor.kind)) return ancestor
      parent = ancestor.parent
    }
  }
  throw new Error("shape")
}

function owns(elements: readonly MarkupElement[], index: number, shape: MarkupElement): boolean {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    const ancestor = elements[parent]
    if (ancestor === undefined) return false
    if (shapeKinds.has(ancestor.kind)) return ancestor.index === shape.index
    parent = ancestor.parent
  }
  return false
}

function attributeEdit(element: MarkupElement, name: string, value: string): ByteEdit {
  const attribute = element.attributes.find((item) => item.name === name)
  if (attribute === undefined) throw new Error(element.kind)
  return { start: attribute.valueStart, end: attribute.valueEnd, next: encodeUtf8(value) }
}

function ownedMatch(
  elements: readonly MarkupElement[],
  shape: MarkupElement,
  kind: string,
  names: readonly string[],
): MarkupElement | null {
  for (const element of elements) {
    if (element.kind !== kind || !owns(elements, element.index, shape)) continue
    if (names.every((name) => element.attributes.some((item) => item.name === name))) return element
  }
  return null
}

function ownedKind(elements: readonly MarkupElement[], shape: MarkupElement, kind: string): MarkupElement | null {
  for (const element of elements) {
    if (element.kind === kind && owns(elements, element.index, shape)) return element
  }
  return null
}

function insertAtBytes(bytes: Uint8Array, at: number, xml: string): Uint8Array {
  return spliceBytes(bytes, [{ start: at, end: at, next: encodeUtf8(xml) }])
}

function writeTransform(
  bytes: Uint8Array,
  elements: readonly MarkupElement[],
  shape: MarkupElement,
  xfrm: string,
): Uint8Array {
  const frame = ownedKind(elements, shape, "a:xfrm")
  if (frame !== null && frame.selfClosing) {
    return spliceBytes(bytes, [{ start: frame.start, end: frame.end, next: encodeUtf8(xfrm) }])
  }
  const spPr = ownedKind(elements, shape, "p:spPr")
  if (spPr === null) throw new Error("p:spPr")
  if (spPr.selfClosing) {
    return spliceBytes(bytes, [{ start: spPr.start, end: spPr.end, next: encodeUtf8(`<p:spPr>${xfrm}</p:spPr>`) }])
  }
  const parentXml = decodeUtf8(bytes.subarray(spPr.start, spPr.end))
  return spliceBytes(bytes, [
    { start: spPr.start, end: spPr.end, next: encodeUtf8(insertChild("p:spPr", "a:xfrm", xfrm, parentXml)) },
  ])
}

function textTarget(bytes: Uint8Array, id: string): { children: MarkupChildren; shape: MarkupElement } {
  const document = requireMarkup(bytes)
  return { children: markupChildren(document.elements), shape: shapeById(document.elements, id) }
}

export function oneRunValue(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
  text: string,
): TextValue {
  const bytes = parts.get(part)
  if (bytes === undefined) throw new Error("part")
  const target = textTarget(bytes, shape)
  return retypedOneRun(shapeTextValue(target.children, bytes, target.shape), text)
}

export type RouteResult = {
  readonly parts: Map<string, Uint8Array>
  readonly id: string | null
}

function editPart(bytes: Uint8Array, route: Exclude<SlideRoute, { readonly name: "add" }>): Uint8Array {
  switch (route.name) {
    case "text": {
      const target = textTarget(bytes, route.shape)
      return spliceBytes(bytes, textValueEdits(target.children, bytes, target.shape, route.value))
    }
    case "move": {
      const x = emu(route.x)
      const y = emu(route.y)
      const document = requireMarkup(bytes)
      const shape = shapeById(document.elements, route.shape)
      const off = ownedMatch(document.elements, shape, "a:off", ["x", "y"])
      if (off === null) {
        const frame = ownedKind(document.elements, shape, "a:xfrm")
        if (frame !== null && !frame.selfClosing) {
          return insertAtBytes(bytes, frame.openEnd, `<a:off x="${x}" y="${y}"/>`)
        }
        return writeTransform(bytes, document.elements, shape, `<a:xfrm><a:off x="${x}" y="${y}"/></a:xfrm>`)
      }
      return spliceBytes(bytes, [attributeEdit(off, "x", String(x)), attributeEdit(off, "y", String(y))])
    }
    case "resize": {
      const cx = emu(route.cx)
      const cy = emu(route.cy)
      const document = requireMarkup(bytes)
      const shape = shapeById(document.elements, route.shape)
      const ext = ownedMatch(document.elements, shape, "a:ext", ["cx", "cy"])
      if (ext === null) {
        const frame = ownedKind(document.elements, shape, "a:xfrm")
        const off = ownedMatch(document.elements, shape, "a:off", ["x", "y"])
        if (frame !== null && !frame.selfClosing) {
          const at = off === null ? frame.openEnd : off.end
          return insertAtBytes(bytes, at, `<a:ext cx="${cx}" cy="${cy}"/>`)
        }
        return writeTransform(bytes, document.elements, shape, `<a:xfrm><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`)
      }
      return spliceBytes(bytes, [attributeEdit(ext, "cx", String(cx)), attributeEdit(ext, "cy", String(cy))])
    }
    case "remove": {
      const document = requireMarkup(bytes)
      const shape = shapeById(document.elements, route.shape)
      return spliceBytes(bytes, [{ start: shape.start, end: shape.end, next: emptyBytes }])
    }
    default: {
      const unexpected: never = route
      throw new Error(String(unexpected))
    }
  }
}

export function writeRoute(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute): RouteResult {
  const current = parts.get(route.part)
  if (current === undefined) throw new Error("part")
  if (route.name === "add") {
    const written = addTextShape(decodeUtf8(current), route.text, {
      x: route.x,
      y: route.y,
      cx: route.cx,
      cy: route.cy,
    })
    const nextBytes = encodeUtf8(written.xml)
    const next = new Map(parts)
    next.set(route.part, sameBytes(nextBytes, current) ? current : nextBytes)
    return { parts: next, id: String(written.id) }
  }
  const nextBytes = editPart(current, route)
  const next = new Map(parts)
  next.set(route.part, sameBytes(nextBytes, current) ? current : nextBytes)
  return { parts: next, id: null }
}

export function applyRoute(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute): Map<string, Uint8Array> {
  return writeRoute(parts, route).parts
}
