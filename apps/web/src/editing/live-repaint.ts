import { clonedLayer, currentValue, history, type ElementId, type Register } from "@airdesign/document"
import { newSlideElement } from "@/editing/exported-parts"

export type BusyElements = {
  readonly hold: (id: ElementId) => () => void
  readonly has: (id: ElementId) => boolean
  readonly missed: (id: ElementId) => void
}

export function busyElements(freed: (id: ElementId) => void = () => undefined): BusyElements {
  const holds = new Map<ElementId, number>()
  const skipped = new Set<ElementId>()
  return {
    hold(id) {
      holds.set(id, (holds.get(id) ?? 0) + 1)
      let held = true
      return () => {
        if (!held) return
        held = false
        const left = (holds.get(id) ?? 1) - 1
        if (left > 0) {
          holds.set(id, left)
          return
        }
        holds.delete(id)
        if (skipped.delete(id)) freed(id)
      }
    },
    has: (id) => holds.has(id),
    missed(id) {
      if (holds.has(id)) skipped.add(id)
    },
  }
}

export function shownValue(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && history(body).length > 0) return currentValue(body)
  const opening = register === null ? undefined : (newSlideElement(register, id) ?? clonedLayer(register, id))
  return opening === undefined ? file : (opening.value ?? "")
}
