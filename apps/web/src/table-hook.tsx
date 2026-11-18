import { currentBox, currentValue, openingElement, type ElementId, type Register } from "@airdesign/document"
import { designRows } from "@/design-rows"
import { imageTexts } from "@/patch-images"

const nothingBound: ReadonlySet<string> = new Set()

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
    return body === undefined || !bound.has(node) ? [] : [[node, currentBox(body)]]
  })
  if (followed.length > 0) return JSON.stringify([register.order, tables, designed, followed])
  if (designed.length > 0) return JSON.stringify([register.order, tables, designed])
  return JSON.stringify(tables.length === 0 ? register.order : [register.order, tables])
}

export function shownTable(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && register?.nodes.includes(id) === true) return currentValue(body)
  return (register === null ? undefined : openingElement(register, id)?.value) ?? file
}
