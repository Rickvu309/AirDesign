import {
  currentBox,
  currentValue,
  floorNodes,
  history,
  openingElement,
  shapeOf,
  slideGone,
  writeTextValue,
  type ElementId,
  type IndexElement,
  type NodeRegister,
  type Register,
  type TextValue,
} from "@airdesign/document"
import { applyRoute, orderedParts, readShapes, type ReadShape } from "@airdesign/pptx"
import { sameBox, textValue } from "@airdesign/render"

type Parts = ReadonlyMap<string, Uint8Array>

export function storedText(value: TextValue): string {
  return value.length === 0 ? "" : writeTextValue(value)
}

export function newSlideElement(register: Register | null, id: ElementId): IndexElement | undefined {
  if (register === null || !id.includes(".")) return undefined
  const slide = shapeOf(id).slide
  const born = register.order.some(
    (command) => (command.slide === "add" || command.slide === "clone") && command.id === slide,
  )
  return born ? openingElement(register, id) : undefined
}

export function slideBase(parts: Parts, register: Register): Parts {
  return register.order.length === 0 ? parts : orderedParts(parts, register)
}

function shapeFor(shapes: readonly ReadShape[], id: ElementId, refusal: string): ReadShape {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
  const shape = named[0]
  if (named.length !== 1 || shape === undefined || shape.locked) throw new Error(refusal)
  return shape
}

function floorShape(shapes: readonly ReadShape[], id: ElementId): ReadShape | undefined {
  const named = shapes.filter((shape) => `${shape.slide}.${shape.shape}` === id)
  const shape = named[0]
  return named.length === 1 && shape !== undefined && !shape.locked ? shape : undefined
}

function withText(
  parts: Parts,
  shapes: readonly ReadShape[],
  id: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
): Parts {
  if (body !== undefined && history(body).length > 0) {
    const { part, shape } = shapeFor(shapes, id, "text-shape")
    return applyRoute(parts, { name: "text", part, shape, value: textValue(currentValue(body)) })
  }
  if (opening === undefined) return parts
  const found = floorShape(shapes, id)
  const value = opening.value ?? ""
  if (found === undefined || storedText(found.text) === value) return parts
  return applyRoute(parts, { name: "text", part: found.part, shape: found.shape, value: textValue(value) })
}

function moved(parts: Parts, { part, shape }: ReadShape, box: NonNullable<IndexElement["box"]>): Parts {
  const next = applyRoute(parts, { name: "move", part, shape, x: box.x, y: box.y })
  return applyRoute(next, { name: "resize", part, shape, cx: box.cx, cy: box.cy })
}

function withBox(
  parts: Parts,
  shapes: readonly ReadShape[],
  id: ElementId,
  body: NodeRegister | undefined,
  opening: IndexElement | undefined,
): Parts {
  const landed = body?.landed.some((row) => row.visible && row.property === "box") === true ? currentBox(body) : null
  if (landed !== null) {
    const found = shapeFor(shapes, id, "box-shape")
    if (found.grouped) throw new Error("group-box")
    return moved(parts, found, landed)
  }
  if (opening === undefined || opening.box === null || opening.grouped) return parts
  const found = floorShape(shapes, id)
  if (found === undefined || found.grouped === true || sameBox(found.box, opening.box)) return parts
  return moved(parts, found, opening.box)
}

export function editedParts(base: Parts, register: Register): Parts {
  const shapes = readShapes(base)
  let next = base
  for (const id of new Set([...register.nodes, ...floorNodes(register)])) {
    if (id.includes(".") && slideGone(register, shapeOf(id).slide)) continue
    const body = register.nodes.includes(id) ? register.elements[id] : undefined
    const opening = newSlideElement(register, id)
    next = withText(next, shapes, id, body, opening)
    next = withBox(next, shapes, id, body, opening)
  }
  return next
}

export function exportedParts(parts: Parts, register: Register): Parts {
  return editedParts(slideBase(parts, register), register)
}
