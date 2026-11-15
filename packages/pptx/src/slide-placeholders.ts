import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partOf, presentationPart, relsOf, slideAddresses } from "./package-address.js"
import { nextShapeId } from "./shape-id.js"

const token = /^[A-Za-z0-9]+$/
const textTypes: ReadonlySet<string | null> = new Set([null, "title", "ctrTitle", "subTitle", "body", "obj"])
const footerTypes: ReadonlySet<string | null> = new Set(["dt", "ftr", "sldNum", "hdr"])
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

function withoutSpans(bytes: Uint8Array, cuts: readonly (readonly [number, number, string])[]): Uint8Array {
  let next = bytes
  for (const [start, end, text] of cuts.toSorted((left, right) => right[0] - left[0])) {
    const put = encodeUtf8(text)
    const merged = new Uint8Array(next.length - (end - start) + put.length)
    merged.set(next.subarray(0, start), 0)
    merged.set(put, start)
    merged.set(next.subarray(end), start + put.length)
    next = merged
  }
  return next
}

function withoutRuns(bytes: Uint8Array): Uint8Array {
  return withoutSpans(
    bytes,
    markupDocument(bytes)
      .elements.filter((element) => element.kind === "a:r" || element.kind === "a:br" || element.kind === "a:fld")
      .map((element) => [element.start, element.end, ""] as const),
  )
}

function textBody(elements: readonly MarkupElement[], shape: MarkupElement): MarkupElement | undefined {
  const body = elements.find((element) => element.kind === "p:txBody" && insideShape(elements, element, shape))
  return body === undefined || body.selfClosing ? undefined : body
}

function openingText(bytes: Uint8Array, elements: readonly MarkupElement[], shape: MarkupElement): string {
  const body = textBody(elements, shape)
  const first =
    body === undefined ? undefined : elements.find((element) => element.kind === "a:p" && element.parent === body.index)
  if (body === undefined || first === undefined) return emptyText
  const head = bytes.subarray(body.start, first.end)
  const tail = bytes.subarray(body.closeStart, body.end)
  const kept = new Uint8Array(head.length + tail.length)
  kept.set(head, 0)
  kept.set(tail, head.length)
  return decodeUtf8(withoutRuns(kept))
}

function footerText(
  bytes: Uint8Array,
  elements: readonly MarkupElement[],
  shape: MarkupElement,
  number: number,
): string {
  const body = textBody(elements, shape)
  if (body === undefined) return emptyText
  const text = bytes.subarray(body.start, body.end)
  const document = markupDocument(text)
  const numbers = document.elements.filter((element) => {
    const field = document.elements[element.parent]
    return (
      element.kind === "a:t" && !element.selfClosing && field?.kind === "a:fld" && attr(field, "type") === "slidenum"
    )
  })
  return decodeUtf8(
    withoutSpans(
      text,
      numbers.map((element) => [element.openEnd, element.closeStart, String(number)] as const),
    ),
  )
}

function relatedPart(parts: ReadonlyMap<string, Uint8Array>, part: string, kind: string): string | null {
  const rels = parts.get(relsOf(part))
  if (rels === undefined) return null
  for (const item of markupDocument(rels).elements) {
    if (item.kind !== "Relationship") continue
    const type = attr(item, "Type")
    const target = attr(item, "Target")
    if (type === null || target === null || !type.endsWith(`/${kind}`)) continue
    return partOf(part, target)
  }
  return null
}

function shownFooters(
  parts: ReadonlyMap<string, Uint8Array>,
  layout: string,
  elements: readonly MarkupElement[],
): ReadonlySet<string | null> {
  const master = relatedPart(parts, layout, "slideMaster")
  const masterBytes = master === null ? undefined : parts.get(master)
  const settings =
    elements.find((element) => element.kind === "p:hf") ??
    (masterBytes === undefined
      ? undefined
      : markupDocument(masterBytes).elements.find((element) => element.kind === "p:hf"))
  if (settings === undefined) return new Set()
  return new Set(
    [...footerTypes].filter((type) => type !== null && !["0", "false"].includes(attr(settings, type) ?? "1")),
  )
}

function slideNumber(parts: ReadonlyMap<string, Uint8Array>, slide: string): number {
  const presentation = parts.get(presentationPart)
  const root =
    presentation === undefined
      ? undefined
      : markupDocument(presentation).elements.find((element) => element.kind === "p:presentation")
  const first = Number.parseInt((root === undefined ? null : attr(root, "firstSlideNum")) ?? "1", 10)
  const position = slideAddresses(parts).findIndex((address) => address.part === slide)
  return (Number.isSafeInteger(first) ? first : 1) + Math.max(position, 0)
}

type Mark = { readonly ph: string; readonly text: string }

function mark(type: string | null, index: string | null, text: string): Mark {
  const kind = type === null ? "" : ` type="${type}"`
  const at = index === null ? "" : ` idx="${index}"`
  return { ph: `<p:ph${kind}${at}/>`, text }
}

export function layoutPart(parts: ReadonlyMap<string, Uint8Array>, slide: string): string | null {
  return relatedPart(parts, slide, "slideLayout")
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
  const footers = shownFooters(parts, layout, layoutDocument.elements)
  for (const element of layoutDocument.elements) {
    if (element.kind !== "p:ph") continue
    const shape = holderShape(layoutDocument.elements, element)
    if (shape === undefined) continue
    const type = attr(element, "type")
    const index = attr(element, "idx")
    if ((type !== null && !token.test(type)) || (index !== null && !token.test(index))) continue
    if (footerTypes.has(type) && !footers.has(type)) continue
    const text = textTypes.has(type)
      ? openingText(layoutBytes, layoutDocument.elements, shape)
      : footerTypes.has(type)
        ? footerText(layoutBytes, layoutDocument.elements, shape, slideNumber(parts, slide))
        : ""
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
