import { owns, shapeById } from "./shape-tree.js"
import type { ListIndent, SlideNumbers, TextValue } from "@airdesign/document"
import { insertChild } from "./child-order.js"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8, sameBytes } from "./package-bytes.js"
import { attachedConnections, shapeAnimated } from "./shape-id.js"
import { PaintPartError, paintReader } from "./paint-reader.js"
import type { TemplateIndent } from "./paragraph-format.js"
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
  | {
      readonly name: "text"
      readonly part: string
      readonly shape: string
      readonly value: TextValue
      readonly numbers?: SlideNumbers
    }
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

function fieldId(part: string, shape: string, paragraph: number, run: number): string {
  const key = `${part}/${shape}/${paragraph}/${run}`
  let hash = 2166136261
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const hex = (hash >>> 0).toString(16).padStart(8, "0")
  return `{${hex}-0000-4000-8000-${Number(shape).toString(16).padStart(12, "0")}}`.toUpperCase()
}

const emptyBytes = new Uint8Array(0)

function emu(value: number): number {
  if (!Number.isInteger(value)) throw new Error("emu")
  return value
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

function paintedIndents(
  parts: ReadonlyMap<string, Uint8Array>,
  part: string,
  shape: string,
): readonly (ListIndent | null)[] | undefined {
  try {
    const found = paintReader(parts)
      .slide(part)
      .elements.find((element) => element.from === "slide" && element.shape === shape)
    return found?.text?.templateIndents
  } catch (error) {
    if (error instanceof PaintPartError) return undefined
    throw error
  }
}

function templateOf(parts: ReadonlyMap<string, Uint8Array>, part: string, shape: string): TemplateIndent {
  let painted: { readonly indents: readonly (ListIndent | null)[] | undefined } | null = null
  return (level) => {
    painted ??= { indents: paintedIndents(parts, part, shape) }
    return painted.indents?.[level] ?? null
  }
}

function editPart(
  bytes: Uint8Array,
  route: Exclude<SlideRoute, { readonly name: "add" }>,
  parts: ReadonlyMap<string, Uint8Array>,
): Uint8Array {
  switch (route.name) {
    case "text": {
      const target = textTarget(bytes, route.shape)
      return spliceBytes(
        bytes,
        textValueEdits(
          target.children,
          bytes,
          target.shape,
          route.value,
          route.numbers,
          (paragraph, run) => fieldId(route.part, route.shape, paragraph, run),
          templateOf(parts, route.part, route.shape),
        ),
      )
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
  const nextBytes = editPart(current, route, parts)
  const next = new Map(parts)
  next.set(route.part, sameBytes(nextBytes, current) ? current : nextBytes)
  return { parts: next, id: null }
}

export function applyRoute(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute): Map<string, Uint8Array> {
  return writeRoute(parts, route).parts
}
