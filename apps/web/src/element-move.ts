import { currentBox, type Box, type ElementId, type Register } from "@airdesign/document"
import { applyRoute, type ReadShape } from "@airdesign/pptx"
import { boxOf, type PaintBox } from "@airdesign/render"
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
  const moved = body?.landed.some(
    (row) => row.visible && (row.v === undefined ? row.property === "box" : row.patch.box !== undefined),
  )
  return body === undefined || moved !== true ? null : currentBox(body)
}

export function shownBox(register: Register | null, id: ElementId, file: Box | null): Box | null {
  return landedBox(register, id) ?? newSlideElement(register, id)?.box ?? file
}

type Painted = { readonly elements: readonly { readonly id: ElementId | null; readonly box: PaintBox | null }[] }

export function paintedBox(slide: Painted | null, id: ElementId): Box | null {
  const box = slide?.elements.find((element) => element.id === id)?.box ?? null
  return box === null ? null : boxOf(box)
}
