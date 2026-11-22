import { clonedLayer, currentValue, history, type Box, type ElementId, type Register } from "@airdesign/document"
import { sameBox, type PaintStore } from "@airdesign/render"
import { landedBox } from "@/editing/element-move"
import { newSlideElement } from "@/editing/exported-parts"

import type { NumberedText } from "@/editing/numbered-text"

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

type Landed = { readonly text: string; readonly box: Box | null }

export function showText(store: PaintStore, id: ElementId, text: string): void {
  const record = store.getElement(id)
  if (record !== null) store.publish({ ...record, text })
}

export function liveRepaint(
  store: PaintStore,
  files: ReadonlyMap<ElementId, string>,
  painted: Register | null,
  busy: BusyElements,
  numberText: NumberedText = (_id, stored) => stored,
): (register: Register, from?: "person", only?: ReadonlySet<ElementId>) => void {
  const landed = new Map<ElementId, Landed>()
  for (const [id, file] of files)
    if (!busy.has(id))
      landed.set(id, { text: numberText(id, shownValue(painted, id, file)), box: landedBox(painted, id) })
  return (register, from, only) => {
    for (const [id, file] of files) {
      const record = store.getElement(id)
      if (record === null || (only !== undefined && !only.has(id))) continue
      if (from !== "person" && busy.has(id)) {
        busy.missed(id)
        landed.delete(id)
        continue
      }
      const before = from === "person" ? { text: record.text, box: store.getBox(id) } : landed.get(id)
      const text = numberText(id, shownValue(register, id, file))
      const box = landedBox(register, id)
      if ((before?.text ?? record.text) !== text) store.publish({ ...record, text })
      if (before === undefined || !sameBox(before.box, box)) store.placeBox(id, box)
      landed.set(id, { text, box })
    }
  }
}
