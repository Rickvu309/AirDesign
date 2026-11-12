import { currentBox, type Box, type ElementId, type Register } from "@airdesign/document"
import { applyRoute, type ReadShape } from "@airdesign/pptx"

const movableKinds: ReadonlySet<ReadShape["kind"]> = new Set(["p:sp", "p:pic", "p:cxnSp"])

export function boxStorable(parts: ReadonlyMap<string, Uint8Array>, shape: ReadShape): boolean {
  if (!movableKinds.has(shape.kind) || shape.locked) return false
  const { part } = shape
  try {
    const moved = applyRoute(parts, { name: "move", part, shape: shape.shape, x: 0, y: 0 })
    applyRoute(moved, { name: "resize", part, shape: shape.shape, cx: 0, cy: 0 })
    return true
  } catch {
    return false
  }
}

export function landedBox(register: Register | null, id: ElementId): Box | null {
  const body = register?.elements[id]
  return body === undefined ? null : currentBox(body)
}
