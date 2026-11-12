import { markupDocument, type MarkupElement } from "./element-span.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { partOf, relsOf } from "./package-address.js"
import { nextShapeId } from "./shape-id.js"

const token = /^[A-Za-z0-9]+$/

function attr(element: MarkupElement, name: string): string | null {
  return element.attributes.find((item) => item.name === name)?.value ?? null
}

function onShape(elements: readonly MarkupElement[], element: MarkupElement): boolean {
  let parent = element.parent
  while (parent >= 0) {
    const next = elements[parent]
    if (next === undefined) return false
    if (next.kind === "p:sp" || next.kind === "p:pic" || next.kind === "p:graphicFrame") return true
    if (next.kind === "p:nvGrpSpPr") return false
    parent = next.parent
  }
  return false
}

function mark(type: string | null, index: string | null): string {
  const kind = type === null ? "" : ` type="${type}"`
  const at = index === null ? "" : ` idx="${index}"`
  return `<p:ph${kind}${at}/>`
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
  const marks: string[] = []
  for (const element of layoutDocument.elements) {
    if (element.kind !== "p:ph" || !onShape(layoutDocument.elements, element)) continue
    const type = attr(element, "type")
    const index = attr(element, "idx")
    if ((type !== null && !token.test(type)) || (index !== null && !token.test(index))) continue
    marks.push(mark(type, index))
  }
  if (marks.length === 0) return parts
  const document = markupDocument(slideBytes)
  const tree = document.elements.find((element) => element.kind === "p:spTree")
  if (!document.wellFormed || tree === undefined || tree.selfClosing || tree.closeStart < 0) return parts
  let id = nextShapeId(decodeUtf8(slideBytes))
  const shapes = encodeUtf8(
    marks
      .map((item) => {
        const shape = `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name=""/><p:cNvSpPr/><p:nvPr>${item}</p:nvPr></p:nvSpPr><p:spPr/></p:sp>`
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
