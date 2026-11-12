import { currentBox, currentValue, history, type ElementId, type Register } from "@airdesign/document"
import { applyRoute, readShapes, type ReadShape } from "@airdesign/pptx"
import { textValue } from "@airdesign/render"

function shapeFor(shapes: readonly ReadShape[], id: ElementId, refusal: string): ReadShape {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
  const shape = named[0]
  if (named.length !== 1 || shape === undefined || shape.locked) throw new Error(refusal)
  return shape
}

export function exportedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): ReadonlyMap<string, Uint8Array> {
  const shapes = readShapes(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined) continue
    if (history(body).length > 0) {
      const { part, shape } = shapeFor(shapes, id, "text-shape")
      next = applyRoute(next, { name: "text", part, shape, value: textValue(currentValue(body)) })
    }
    const box = currentBox(body)
    if (box === null) continue
    const { part, shape } = shapeFor(shapes, id, "box-shape")
    next = applyRoute(next, { name: "move", part, shape, x: box.x, y: box.y })
    next = applyRoute(next, { name: "resize", part, shape, cx: box.cx, cy: box.cy })
  }
  return next
}
