import type { ElementId } from "@airdesign/document"
import type { PaintStore, RotationGrip } from "./store.js"

export type RotationGrips = {
  readonly grip: (store: PaintStore, ids: readonly ElementId[]) => void
  readonly place: (id: ElementId, rotation: number) => void
  readonly drop: (id: ElementId) => void
  readonly end: (changed: readonly ElementId[]) => void
}

export function rotationGrips(): RotationGrips {
  let held = new Map<ElementId, RotationGrip>()
  return {
    grip(store, ids) {
      held = new Map(ids.map((id) => [id, store.gripRotation(id)]))
    },
    place(id, rotation) {
      held.get(id)?.place(rotation)
    },
    drop(id) {
      held.get(id)?.release()
      held.delete(id)
    },
    end(changed) {
      for (const [id, grip] of held) {
        if (changed.includes(id)) grip.keep()
        else grip.release()
      }
      held = new Map()
    },
  }
}
