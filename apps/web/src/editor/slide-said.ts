import { slideListCopy } from "@/copy/slide-list-copy"
import type { UndoName } from "@/copy/undo-copy"

const slideTurns = new Set<UndoName>(["new", "duplicate", "delete", "order"])

export type SlideTurn = {
  readonly before: number
  readonly after: number
  readonly count: number
  readonly held: number
}

function landed(turn: SlideTurn): number {
  if (turn.after >= 0) return turn.after + 1
  return Math.max(0, Math.min(turn.held, turn.count - 1)) + 1
}

export function slideTurnSaid(direction: "undo" | "redo", name: UndoName, turn: SlideTurn): string | null {
  if (!slideTurns.has(name) || turn.count < 1) return null
  if (name === "order") {
    if (turn.before < 0 || turn.after < 0 || turn.before === turn.after) return null
    return slideListCopy.moved(turn.before + 1, turn.after + 1)
  }
  if (direction === "redo" && name === "new" && turn.after >= 0) return slideListCopy.added(turn.after + 1)
  if (direction === "redo" && name === "duplicate" && turn.after >= 0) return slideListCopy.duplicated(turn.after)
  if (direction === "redo" && name === "delete" && turn.before >= 0) return slideListCopy.deleted(turn.before + 1)
  return slideListCopy.slideName(landed(turn), turn.count)
}
