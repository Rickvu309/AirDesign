import { currentBox, followsGroups, type Box, type ElementId, type Register } from "@airdesign/document"
import { applyRoute, type ReadShape } from "@airdesign/pptx"
import { boxOf, type PaintBox } from "@airdesign/render"
import { newSlideElement } from "@/editing/exported-parts"
import { laidBox } from "@/editing/frame-boxes"

const movableKinds: ReadonlySet<ReadShape["kind"]> = new Set(["p:sp", "p:pic", "p:cxnSp", "p:grpSp"])

function movableKind(shape: ReadShape): boolean {
  return movableKinds.has(shape.kind)
}

export function boxStorable(parts: ReadonlyMap<string, Uint8Array>, shape: ReadShape, placed = false): boolean {
  if (!movableKind(shape) || shape.locked || (shape.grouped && !placed)) return false
  const { part } = shape
  try {
    applyRoute(parts, { name: "move", part, shape: shape.shape, x: 0, y: 0 })
    applyRoute(parts, { name: "resize", part, shape: shape.shape, cx: 0, cy: 0 })
    return true
  } catch {
    return false
  }
}

export function landedBox(register: Register | null, id: ElementId): Box | null {
  const laid = register === null ? undefined : laidBox(register, id)
  if (laid !== undefined) return laid
  const body = register?.elements[id]
  const moved = body?.landed.some(
    (row) => row.visible && (row.v === undefined ? row.property === "box" : row.patch.box !== undefined),
  )
  if (register === null || body === undefined || moved !== true || followsGroups(register, id)) return null
  return currentBox(body)
}

export function shownBox(register: Register | null, id: ElementId, file: Box | null): Box | null {
  return landedBox(register, id) ?? newSlideElement(register, id)?.box ?? file
}

type Painted = { readonly elements: readonly { readonly id: ElementId | null; readonly box: PaintBox | null }[] }

export function paintedBox(slide: Painted | null, id: ElementId): Box | null {
  const box = slide?.elements.find((element) => element.id === id)?.box ?? null
  return box === null ? null : boxOf(box)
}
