import type { ElementId } from "@airdesign/document"
import type { PaintStore } from "@airdesign/render"

const fitTurns = new WeakMap<PaintStore, Map<ElementId, number>>()

export function latestFit(store: PaintStore, node: ElementId): () => boolean {
  const turns = fitTurns.get(store) ?? new Map<ElementId, number>()
  fitTurns.set(store, turns)
  const turn = (turns.get(node) ?? 0) + 1
  turns.set(node, turn)
  return () => turns.get(node) === turn
}
