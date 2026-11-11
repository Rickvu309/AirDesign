import { currentValue, history, type Register } from "@airdesign/document"
import { applyRoute, readShapes } from "@airdesign/pptx"
import { textValue } from "@airdesign/render"

export function exportedParts(
  parts: ReadonlyMap<string, Uint8Array>,
  register: Register,
): ReadonlyMap<string, Uint8Array> {
  const shapes = readShapes(parts)
  let next: ReadonlyMap<string, Uint8Array> = parts
  for (const id of register.nodes) {
    const body = register.elements[id]
    if (body === undefined || history(body).length === 0) continue
    const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
    const shape = named[0]
    if (named.length !== 1 || shape === undefined || shape.locked) throw new Error("text-shape")
    next = applyRoute(next, {
      name: "text",
      part: shape.part,
      shape: shape.shape,
      value: textValue(currentValue(body)),
    })
  }
  return next
}
