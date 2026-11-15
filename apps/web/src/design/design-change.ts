import type { Bound, ElementId, Place, SetChange } from "@airdesign/document"
import { connect } from "@airdesign/live"
import { toast } from "sonner"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { designCopy } from "@/copy/design-copy"
import { applyChange, valueFits, type ChangingDeck } from "@/design/trait-edit"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
import { fileTableValue } from "@/table-edit"
import { structureOf } from "@/table-hook"
import type { UndoEntry } from "@/undo-list"

export type DesignDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly setPending: (pending: boolean) => void
}

export function fileValue(shown: DeckPaint, node: ElementId): string | null {
  const shape = shown.shapes.current.get(node)
  return shape?.contentKind === "table" ? fileTableValue(shown.editParts.current, shape) : null
}

function changingDeck(deck: DesignDeck, session: number | null): ChangingDeck {
  const { shown, undo } = deck
  return {
    id: deck.id,
    parts: () => shown.shownParts.current,
    floor: (node) => shown.boxes.current.get(node)?.file ?? shown.movables.current.get(node)?.file ?? "",
    file: (node) => fileValue(shown, node),
    fits: (node, value) => valueFits(shown.editParts.current, shown.shapes.current.get(node), value),
    hold: () => undo.records.current.hold(),
    record: (entry) => deck.record(session === null ? entry : { ...entry, session }),
    show: (register) => {
      if (shown.structure.current !== structureOf(register, shown.bound.current)) shown.showRegister(register)
      shown.repaint.current(register, "person")
      deck.setPending(true)
    },
  }
}

export function endChange(node: ElementId, end: "start" | "end", to: Bound | Place): SetChange {
  if ("node" in to) return { target: { node }, connection: { [end]: { shape: to } } }
  const { box, flipH, flipV } = to
  return {
    target: { node },
    box: { x: box.x, y: box.y, w: box.cx, h: box.cy, flipH, flipV },
    connection: { [end]: { none: true } },
  }
}

export function changeDesign(deck: DesignDeck, change: () => SetChange) {
  const session = deck.undo.focused.current
  deck.undo.turnAfter(async () => {
    if (await applyChange(changingDeck(deck, session), change())) {
      void flushPending(connect, deck.id).then(deck.settle)
      return
    }
    toast.error(designCopy.refused)
    deck.settle("refused")
  })
}
