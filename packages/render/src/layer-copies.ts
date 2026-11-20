import type { Box, ElementId } from "@airdesign/document"
import type { Moved } from "./box-gesture.js"
import type { DragSnap } from "./drag-snap.js"
import { boundsOf } from "./snapping.js"

export type Offset = { readonly dx: number; readonly dy: number }

export type Copied = { readonly copy: ElementId; readonly source: ElementId }

export type CopyBoard = {
  readonly show: (ids: readonly ElementId[]) => void
  readonly has: (id: ElementId) => boolean
  readonly subscribe: (listener: () => void) => () => void
}

const still: Offset = { dx: 0, dy: 0 }

export function copyBoard(): CopyBoard {
  let shown: ReadonlySet<ElementId> = new Set()
  const listeners = new Set<() => void>()
  return {
    show(ids) {
      if (ids.length === shown.size && ids.every((id) => shown.has(id))) return
      shown = new Set(ids)
      for (const listener of Array.from(listeners)) listener()
    },
    has: (id) => shown.has(id),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function sameIds(left: readonly ElementId[], right: readonly ElementId[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id))
}

export function lastOffset(
  chosen: readonly ElementId[],
  last: readonly Copied[],
  boxOf: (id: ElementId) => Box | null,
): Offset {
  const [lead] = last
  const copies = last.map((each) => each.copy)
  if (lead === undefined || !sameIds(chosen, copies)) return still
  const from = boxOf(lead.source)
  const to = boxOf(lead.copy)
  return from === null || to === null ? still : { dx: to.x - from.x, dy: to.y - from.y }
}

export function copiesInPlace(starts: ReadonlyMap<ElementId, Box>, offset: Offset): readonly Moved[] {
  return [...starts].map(([id, box]) => ({ id, box: { ...box, x: box.x + offset.dx, y: box.y + offset.dy } }))
}

export function copySnap(snap: DragSnap, starts: ReadonlyMap<ElementId, Box>): DragSnap {
  const sources = [...starts].map(([id, box]) => boundsOf(box, snap.turns.get(id) ?? 0))
  return { ...snap, layers: [...snap.layers, ...sources] }
}
