import { insertChild } from "./child-order.js"
import { markupDocument, spliceBytes, type ByteEdit, type MarkupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { addTextShape, xmlText } from "./shape-write.js"

export type SlideRoute =
  | { readonly name: "text"; readonly part: string; readonly shape: string; readonly text: string }
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
const runKinds = new Set(["a:r", "a:br", "a:fld"])
const emptyBytes = new Uint8Array(0)
const textOpen = encodeUtf8("<a:t>")
const textClose = encodeUtf8("</a:t>")

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

function inside(elements: readonly MarkupElement[], index: number, ancestor: MarkupElement): boolean {
  let parent = elements[index]?.parent ?? -1
  while (parent >= 0) {
    if (parent === ancestor.index) return true
    const next = elements[parent]
    if (next === undefined) return false
    parent = next.parent
  }
  return false
}

function textElement(escaped: Uint8Array): Uint8Array {
  const next = new Uint8Array(textOpen.length + escaped.length + textClose.length)
  next.set(textOpen, 0)
  next.set(escaped, textOpen.length)
  next.set(textClose, textOpen.length + escaped.length)
  return next
}

function textEdit(element: MarkupElement, escaped: Uint8Array): ByteEdit {
  if (element.selfClosing) return { start: element.start, end: element.end, next: textElement(escaped) }
  if (element.closeStart < element.openEnd) throw new Error("text")
  return { start: element.openEnd, end: element.closeStart, next: escaped }
}

function textEdits(elements: readonly MarkupElement[], shape: MarkupElement, text: string): readonly ByteEdit[] {
  const runs: MarkupElement[] = []
  const texts: MarkupElement[] = []
  for (const element of elements) {
    if (!owns(elements, element.index, shape)) continue
    if (runKinds.has(element.kind)) runs.push(element)
    if (element.kind === "a:t") texts.push(element)
  }
  const firstRun = runs.find((element) => element.kind === "a:r")
  const escaped = encodeUtf8(xmlText(text))
  const edits: ByteEdit[] = []
  const remove = (element: MarkupElement) => {
    edits.push({ start: element.start, end: element.end, next: emptyBytes })
  }
  if (firstRun !== undefined) {
    const inner = texts.filter((element) => inside(elements, element.index, firstRun))
    const firstText = inner[0]
    if (firstText === undefined) {
      if (firstRun.closeStart < 0) throw new Error("text")
      edits.push({ start: firstRun.closeStart, end: firstRun.closeStart, next: textElement(escaped) })
    } else {
      edits.push(textEdit(firstText, escaped))
      for (const extra of inner.slice(1)) remove(extra)
    }
    for (const run of runs) {
      if (run.index !== firstRun.index) remove(run)
    }
    for (const extra of texts) {
      if (inside(elements, extra.index, firstRun)) continue
      const covered = runs.some((run) => run.index !== firstRun.index && inside(elements, extra.index, run))
      if (!covered) remove(extra)
    }
    return edits
  }
  const firstText = texts[0]
  if (firstText === undefined) throw new Error("text")
  edits.push(textEdit(firstText, escaped))
  for (const extra of texts.slice(1)) remove(extra)
  for (const run of runs) remove(run)
  return edits
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

function editPart(bytes: Uint8Array, route: SlideRoute): Uint8Array {
  switch (route.name) {
    case "text": {
      const document = requireMarkup(bytes)
      const shape = shapeById(document.elements, route.shape)
      return spliceBytes(bytes, textEdits(document.elements, shape, route.text))
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
    case "add":
      return encodeUtf8(
        addTextShape(decodeUtf8(bytes), route.text, {
          x: emu(route.x),
          y: emu(route.y),
          cx: emu(route.cx),
          cy: emu(route.cy),
        }),
      )
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

export function applyRoute(parts: ReadonlyMap<string, Uint8Array>, route: SlideRoute): ReadonlyMap<string, Uint8Array> {
  const current = parts.get(route.part)
  if (current === undefined) throw new Error("part")
  const nextBytes = editPart(current, route)
  const next = new Map(parts)
  next.set(route.part, sameBytes(nextBytes, current) ? current : nextBytes)
  return next
}
