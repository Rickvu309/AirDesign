import { elementId, writeTextValue, type DeckIndex } from "@airdesign/document"
import { readShapes, readSlides } from "./read-shapes.js"
import { paintKind } from "./shape-tree.js"

export function indexPackage(parts: ReadonlyMap<string, Uint8Array>): Pick<DeckIndex, "slides" | "elements"> {
  const slides = readSlides(parts).map(({ slide }, position) => ({ id: slide, position }))
  const order = new Map(slides.map((slide) => [slide.id, slide.position]))
  const elements = readShapes(parts).map((shape) => ({
    node: elementId(`${shape.slide}.${shape.shape}`),
    kind: shape.contentKind ?? paintKind(shape.kind),
    value: shape.text.length === 0 ? null : writeTextValue(shape.text),
    box: shape.box,
    grouped: shape.grouped === true,
  }))
  elements.sort((left, right) => {
    const slide = (order.get(left.node.split(".")[0] ?? "") ?? 0) - (order.get(right.node.split(".")[0] ?? "") ?? 0)
    return slide || (left.node < right.node ? -1 : left.node > right.node ? 1 : 0)
  })
  return { slides, elements }
}
