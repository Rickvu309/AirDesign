import { currentValue, landedPatch, shapeOf, type ElementId, type Register } from "@airdesign/document"
import { fittedTable, readSlides } from "@airdesign/pptx"
import type { MeasuredRows } from "@airdesign/render"

type Parts = ReadonlyMap<string, Uint8Array>

function editedValue(register: Register, node: ElementId): string | null {
  const body = register.nodes.includes(node) ? register.elements[node] : undefined
  if (body === undefined || landedPatch(body, "table").table?.value === undefined) return null
  return currentValue(body)
}

export function bakeRows(parts: Parts, register: Register, rows: ReadonlyMap<ElementId, MeasuredRows>): Parts {
  const slides = readSlides(parts)
  let next = parts
  for (const [node, painted] of rows) {
    if (editedValue(register, node) !== painted.written) continue
    const { slide, shape } = shapeOf(node)
    const part = slides.find((each) => each.slide === slide)?.part
    if (part === undefined) continue
    try {
      next = fittedTable(next, { part, shape, height: painted.height }, painted.heights)
    } catch {
      continue
    }
  }
  return next
}
