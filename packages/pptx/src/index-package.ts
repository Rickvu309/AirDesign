import { elementId, writeTextValue, type DeckIndex } from "@airdesign/document"
import { readNotes } from "./notes-body.js"
import { readShapes, readSlides, shapeKind } from "./read-shapes.js"
import { presentationPart } from "./package-address.js"
import { markupDocument } from "./element-span.js"
import { animatedShapeIds, freeShapeId } from "./shape-id.js"

function slideSize(parts: ReadonlyMap<string, Uint8Array>): { readonly width: number; readonly height: number } | null {
  const bytes = parts.get(presentationPart)
  const element =
    bytes === undefined ? undefined : markupDocument(bytes).elements.find((each) => each.kind === "p:sldSz")
  const width = Number(element?.attributes.find((item) => item.name === "cx")?.value)
  const height = Number(element?.attributes.find((item) => item.name === "cy")?.value)
  return Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0
    ? { width, height }
    : null
}

export function indexPackage(parts: ReadonlyMap<string, Uint8Array>): Pick<DeckIndex, "slides" | "elements"> {
  const size = slideSize(parts)
  const slides = readSlides(parts).map(({ slide, part }, position) => {
    const bytes = parts.get(part)
    return {
      id: slide,
      position,
      ...(size === null ? {} : { size }),
      free: freeShapeId(parts, part),
      animated: bytes === undefined ? [] : animatedShapeIds(bytes),
    }
  })
  const order = new Map(slides.map((slide) => [slide.id, slide.position]))
  const elements = readShapes(parts).map((shape) => ({
    node: elementId(`${shape.slide}.${shape.shape}`),
    kind: shapeKind(shape),
    value: shape.text.length === 0 ? null : writeTextValue(shape.text),
    box: shape.box,
    grouped: shape.grouped === true,
  }))
  elements.push(
    ...readNotes(parts).map((notes) => ({
      node: elementId(`${notes.slide}.notes`),
      kind: "slide" as const,
      value: notes.text,
      box: null,
      grouped: false,
    })),
  )
  elements.sort((left, right) => {
    const slide = (order.get(left.node.split(".")[0] ?? "") ?? 0) - (order.get(right.node.split(".")[0] ?? "") ?? 0)
    return slide || (left.node < right.node ? -1 : left.node > right.node ? 1 : 0)
  })
  return { slides, elements }
}
