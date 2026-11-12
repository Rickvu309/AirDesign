import type { UndoName } from "@/copy/undo-copy"
import { currentBox, type Box, type ElementId, type Register } from "@airdesign/document"
import { applyRoute, type ReadShape } from "@airdesign/pptx"
import { newSlideElement } from "@/exported-parts"

const movableKinds: ReadonlySet<ReadShape["kind"]> = new Set(["p:sp", "p:pic", "p:cxnSp"])

export function boxStorable(parts: ReadonlyMap<string, Uint8Array>, shape: ReadShape): boolean {
  if (!movableKinds.has(shape.kind) || shape.locked || shape.grouped) return false
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
  return body === undefined || !body.landed.some((row) => row.visible && row.property === "box")
    ? null
    : currentBox(body)
}

export function shownBox(register: Register | null, id: ElementId, file: Box | null): Box | null {
  return landedBox(register, id) ?? newSlideElement(register, id)?.box ?? file
}

export function boxName(before: Box, after: Box): UndoName | null {
  if (before.cx !== after.cx || before.cy !== after.cy) return "resize"
  return before.x === after.x && before.y === after.y ? null : "move"
}
