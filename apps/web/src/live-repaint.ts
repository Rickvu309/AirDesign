import { currentValue, history, type Box, type ElementId, type Register } from "@airdesign/document"
import { sameBox, type PaintStore } from "@airdesign/render"
import { landedBox } from "@/element-move"
import { newSlideElement } from "@/exported-parts"

export type BusyElements = {
  readonly hold: (id: ElementId) => () => void
  readonly has: (id: ElementId) => boolean
}

export function busyElements(): BusyElements {
  const holds = new Map<ElementId, number>()
  return {
    hold(id) {
      holds.set(id, (holds.get(id) ?? 0) + 1)
      let held = true
      return () => {
        if (!held) return
        held = false
        const left = (holds.get(id) ?? 1) - 1
        if (left > 0) holds.set(id, left)
        else holds.delete(id)
      }
    },
    has: (id) => holds.has(id),
  }
}

export function shownValue(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && history(body).length > 0) return currentValue(body)
  const opening = newSlideElement(register, id)
  return opening === undefined ? file : (opening.value ?? "")
}

type Landed = { readonly text: string; readonly box: Box | null }

export function liveRepaint(
  store: PaintStore,
  files: ReadonlyMap<ElementId, string>,
  painted: Register | null,
  busy: BusyElements,
): (register: Register, from?: "person") => void {
  const landed = new Map<ElementId, Landed>()
  for (const [id, file] of files) landed.set(id, { text: shownValue(painted, id, file), box: landedBox(painted, id) })
  return (register, from) => {
    for (const [id, file] of files) {
      const record = store.getElement(id)
      if (record === null || busy.has(id)) continue
      const before = from === "person" ? { text: record.text, box: store.getBox(id) } : landed.get(id)
      const text = shownValue(register, id, file)
      const box = landedBox(register, id)
      if (before?.text !== text) store.publish({ ...record, text })
      if (before === undefined || !sameBox(before.box, box)) store.placeBox(id, box)
      landed.set(id, { text, box })
    }
  }
}
