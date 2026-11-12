import { owns, shapeById } from "./shape-tree.js"
import type { TextValue } from "@airdesign/document"
import { insertChild } from "./child-order.js"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { attachedConnections, shapeAnimated } from "./shape-id.js"
import { addTextShape } from "./shape-write.js"
import {
  markupChildren,
  oneRunIn,
  shapeTextValue,
  textValueEdits,
  type MarkupChildren,
  type OneRun,
} from "./text-value-route.js"

export type SlideRoute =
  | { readonly name: "spPr.fill"; readonly part: string; readonly shape: string; readonly value: ShapeFill }
  | { readonly name: "text"; readonly part: string; readonly shape: string; readonly value: TextValue }
  | { readonly name: "move"; readonly part: string; readonly shape: string; readonly x: number; readonly y: number }
  | { readonly name: "resize"; readonly part: string; readonly shape: string; readonly cx: number; readonly cy: number }
  | {
      readonly name: "add"
      readonly id?: number
      readonly part: string
      readonly text: string
      readonly x: number
      readonly y: number
      readonly cx: number
      readonly cy: number
    }
  | { readonly name: "remove"; readonly part: string; readonly shape: string }

const emptyBytes = new Uint8Array(0)

export type ShapeFill =
  | { readonly kind: "none" }
  | { readonly kind: "srgb"; readonly value: string }
  | { readonly kind: "theme"; readonly value: string }

const themeColors = new Set([
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
  "bg1",
  "tx1",
  "bg2",
  "tx2",
  "phClr",
])
const fillKinds = new Set(["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"])

function fillXml(value: ShapeFill): { tag: "a:noFill" | "a:solidFill"; xml: string } {
  if (value.kind === "none") return { tag: "a:noFill", xml: "<a:noFill/>" }
  if (value.kind === "srgb" && /^[0-9a-fA-F]{6}$/.test(value.value)) {
    return { tag: "a:solidFill", xml: `<a:solidFill><a:srgbClr val="${value.value}"/></a:solidFill>` }
  }
  if (value.kind === "theme" && themeColors.has(value.value)) {
    return { tag: "a:solidFill", xml: `<a:solidFill><a:schemeClr val="${value.value}"/></a:solidFill>` }
  }
  throw new Error("fill-color")
}

function writeFill(bytes: Uint8Array, id: string, value: ShapeFill): Uint8Array {
  const document = requireMarkup(bytes)
  const shape = shapeById(document.elements, id)
  if (shape.kind !== "p:sp") throw new Error("fill-shape")
  const properties = document.elements.filter((item) => item.parent === shape.index && item.kind === "p:spPr")
  const spPr = properties[0]
  if (properties.length !== 1 || spPr === undefined) throw new Error("fill-properties")
  const fills = document.elements.filter((item) => item.parent === spPr.index && fillKinds.has(item.kind))
  if (fills.length > 1) throw new Error("fill-choice")
  const fill = fills[0]
  if (fill?.kind === "a:blipFill") throw new Error("fill-relationship")
  const next = fillXml(value)
  if (fill !== undefined) {
    return spliceBytes(bytes, [{ start: fill.start, end: fill.end, next: encodeUtf8(next.xml) }])
  }
  if (spPr.selfClosing) {
    return spliceBytes(bytes, [
      {
        start: spPr.openEnd - 2,
        end: spPr.openEnd,
        next: encodeUtf8(`>${next.xml}</p:spPr>`),
      },
    ])
  }
  const parent = decodeUtf8(bytes.subarray(spPr.start, spPr.end))
  return spliceBytes(bytes, [
    {
      start: spPr.start,
      end: spPr.end,
      next: encodeUtf8(insertChild("p:spPr", next.tag, next.xml, parent)),
    },
  ])
}

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

function oneRunRead(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
): (OneRun & { readonly text: string }) | null {
  const bytes = parts.get(part)
  if (bytes === undefined) return null
  let target: { children: MarkupChildren; shape: MarkupElement }
  try {
    target = textTarget(bytes, shape)
  } catch {
    return null
  }
  const value = shapeTextValue(target.children, bytes, target.shape)
  const found = oneRunIn(value)
  const text = value[0]?.runs[0]?.text
  return found === null || text === undefined ? null : { ...found, text }
}

export function oneRunValue(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
  text: string,
): TextValue {
  const found = oneRunRead(parts, part, shape)
  if (found === null) throw new Error("text-shape")
  const value = [{ from: found.paragraph, runs: [{ from: found.run, text }] }]
  writeRoute(parts, { name: "text", part, shape, value })
  return value
}

export function textStorable(parts: ReadonlyMap<string, Uint8Array>, part: string, shape: string): boolean {
  const current = oneRunRead(parts, part, shape)
  if (current === null) return false
  try {
    oneRunValue(parts, part, shape, `${current.text}.`)
    return true
  } catch {
    return false
  }
}

export type RouteResult = {
  readonly parts: Map<string, Uint8Array>
  readonly id: string | null
}

export function removeShape(bytes: Uint8Array, id: string): Uint8Array {
  const { elements } = requireMarkup(bytes)
  const shape = shapeById(elements, id)
  if (shapeAnimated(elements, shape)) throw new Error("shape-animated")
  const pieces = [shape, ...attachedConnections(elements, shape)]
  return spliceBytes(
    bytes,
    pieces.map(({ start, end }) => ({ start, end, next: emptyBytes })),
  )
}

function editPart(bytes: Uint8Array, route: Exclude<SlideRoute, { readonly name: "add" }>): Uint8Array {
  switch (route.name) {
    case "spPr.fill":
      return writeFill(bytes, route.shape, route.value)
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
    case "remove":
      return removeShape(bytes, route.shape)
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
    const { x, y, cx, cy } = route
    const written = addTextShape(decodeUtf8(current), route.text, { x, y, cx, cy }, route.id)
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
