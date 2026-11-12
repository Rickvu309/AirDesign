import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partOf, relsOf } from "./package-address.js"
import { nextShapeId } from "./shape-id.js"

const token = /^[A-Za-z0-9]+$/
const textTypes: ReadonlySet<string | null> = new Set([null, "title", "ctrTitle", "subTitle", "body", "obj"])
const emptyText = "<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>"

function attr(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function holderShape(elements: readonly MarkupElement[], element: MarkupElement): MarkupElement | undefined {
  let parent = element.parent
  while (parent >= 0) {
    const next = elements[parent]
    if (next === undefined) return undefined
    if (next.kind === "p:sp" || next.kind === "p:pic" || next.kind === "p:graphicFrame") return next
    if (next.kind === "p:nvGrpSpPr") return undefined
    parent = next.parent
  }
  return undefined
}

function insideShape(elements: readonly MarkupElement[], element: MarkupElement, shape: MarkupElement): boolean {
  let parent = element.parent
  while (parent >= 0) {
    if (parent === shape.index) return true
    const next = elements[parent]
    if (next === undefined) return false
    if (next.kind === "p:sp" || next.kind === "p:pic" || next.kind === "p:graphicFrame") return false
    parent = next.parent
  }
  return false
}

function withoutRuns(bytes: Uint8Array): Uint8Array {
  const cuts = markupDocument(bytes)
    .elements.filter((element) => element.kind === "a:r" || element.kind === "a:br" || element.kind === "a:fld")
    .map((element) => [element.start, element.end] as const)
    .sort((left, right) => right[0] - left[0])
  let next = bytes
  for (const [start, end] of cuts) {
    const merged = new Uint8Array(next.length - (end - start))
    merged.set(next.subarray(0, start), 0)
    merged.set(next.subarray(end), start)
    next = merged
  }
  return next
}

function layoutText(bytes: Uint8Array, elements: readonly MarkupElement[], shape: MarkupElement): string {
  const body = elements.find((element) => element.kind === "p:txBody" && insideShape(elements, element, shape))
  if (body === undefined || body.selfClosing) return emptyText
  return decodeUtf8(withoutRuns(bytes.subarray(body.start, body.end)))
}

type Mark = { readonly ph: string; readonly text: string }

function mark(type: string | null, index: string | null, text: string): Mark {
  const kind = type === null ? "" : ` type="${type}"`
  const at = index === null ? "" : ` idx="${index}"`
  return { ph: `<p:ph${kind}${at}/>`, text }
}

export function layoutPart(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  const rels = parts.get(relsOf(slide))
  if (rels === undefined) return null
  for (const item of markupDocument(rels).elements) {
    if (item.kind !== "Relationship") continue
    const type = attr(item, "Type")
    const target = attr(item, "Target")
    if (type === null || target === null || !type.endsWith("/slideLayout")) continue
    return partOf(slide, target)
  }
  return null
}

export function withLayoutPlaceholders(
  parts: ReadonlyMap<string, Uint8Array>,
  slide: string,
  layout: string,
): ReadonlyMap<string, Uint8Array> {
  const layoutBytes = parts.get(layout)
  const slideBytes = parts.get(slide)
  if (layoutBytes === undefined || slideBytes === undefined) return parts
  const layoutDocument = markupDocument(layoutBytes)
  const marks: Mark[] = []
  for (const element of layoutDocument.elements) {
    if (element.kind !== "p:ph") continue
    const shape = holderShape(layoutDocument.elements, element)
    if (shape === undefined) continue
    const type = attr(element, "type")
    const index = attr(element, "idx")
    if ((type !== null && !token.test(type)) || (index !== null && !token.test(index))) continue
    const text = textTypes.has(type) ? layoutText(layoutBytes, layoutDocument.elements, shape) : ""
    marks.push(mark(type, index, text))
  }
  if (marks.length === 0) return parts
  const document = markupDocument(slideBytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (!document.wellFormed || tree === undefined || tree.selfClosing || tree.closeStart < 0) return parts
  let id = nextShapeId(decodeUtf8(slideBytes))
  const shapes = encodeUtf8(
    marks
      .map((item) => {
        const shape = `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name=""/><p:cNvSpPr/><p:nvPr>${item.ph}</p:nvPr></p:nvSpPr><p:spPr/>${item.text}</p:sp>`
        id += 1
        return shape
      })
      .join(""),
  )
  const merged = new Uint8Array(tree.closeStart + shapes.length + slideBytes.length - tree.closeStart)
  merged.set(slideBytes.subarray(0, tree.closeStart), 0)
  merged.set(shapes, tree.closeStart)
  merged.set(slideBytes.subarray(tree.closeStart), tree.closeStart + shapes.length)
  const next = new Map(parts)
  next.set(slide, merged)
  return next
}
