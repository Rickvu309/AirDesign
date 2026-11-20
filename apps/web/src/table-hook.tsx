import {
  currentBox,
  currentValue,
  groupedNow,
  measureStale,
  openingElement,
  type ElementId,
  type Register,
} from "@airdesign/document"
import { designRows } from "@/design-rows"
import { imageTexts } from "@/patch-images"

const nothingBound: ReadonlySet<string> = new Set()

function resized(register: Register): readonly (readonly [ElementId, number, number])[] {
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const floor = body?.floorBox
    if (body === undefined || floor === undefined) return []
    const box = currentBox(body)
    if (box === null || (box.cx === floor.cx && box.cy === floor.cy)) return []
    return [[node, box.cx, box.cy]]
  })
}

function inGroupOrGroup(register: Register, node: ElementId): boolean {
  return groupedNow(register, node) || openingElement(register, node)?.kind === "group"
}

export function structureOf(register: Register | null, bound: ReadonlySet<string> = nothingBound): string {
  if (register === null) return "[]"
  const tables = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return value.startsWith('{"rows"') ? [[node, value]] : []
  })
  const designed = [...designRows(register), ...imageTexts(register)]
  const followed = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const placedByPaint = bound.has(node) || inGroupOrGroup(register, node)
    return body === undefined || !placedByPaint ? [] : [[node, currentBox(body)]]
  })
  const sizes = [...resized(register), ...measureStale(register)]
  if (sizes.length > 0) return JSON.stringify([register.order, tables, designed, followed, sizes])
  if (followed.length > 0) return JSON.stringify([register.order, tables, designed, followed])
  if (designed.length > 0) return JSON.stringify([register.order, tables, designed])
  return JSON.stringify(tables.length === 0 ? register.order : [register.order, tables])
}

export function shownTable(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && register?.nodes.includes(id) === true) return currentValue(body)
  return (register === null ? undefined : openingElement(register, id)?.value) ?? file
}
