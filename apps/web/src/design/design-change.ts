import type { Bound, ElementId, Place, PlacedRow, Register, SetChange } from "@airdesign/document"
import { connect } from "@airdesign/live"
import { toast } from "@/components/ui/toast"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { designCopy } from "@/copy/design-copy"
import { applyChange, applyRows, valueFits, type ChangingDeck } from "@/design/trait-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
import { withFileFloors } from "@/deck-paint"
import { fileTableValue } from "@/table-edit"
import { structureOf } from "@/table-hook"
import type { UndoEntry } from "@/undo-list"

export type DesignDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
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
      const framed = withFileFloors(register, shown.shownParts.current)
      if (shown.structure.current !== structureOf(framed, shown.bound.current)) shown.showRegister(register)
      shown.repaint.current(register, "person")
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

export function changeDesign(
  deck: DesignDeck,
  change: () => SetChange | readonly SetChange[],
  afterPaint?: () => void,
) {
  const session = deck.undo.focused.current
  deck.undo.turnAfter(async () => {
    if (await applyChange(changingDeck(deck, session), change())) {
      afterPaint?.()
      void flushPending(connect, deck.id).then(deck.settle)
      return
    }
    toast.error(designCopy.refused, { duration: Infinity, closeButton: true })
    deck.settle("refused")
  })
}

export function changeRows(
  deck: DesignDeck,
  plan: (register: Register) => readonly PlacedRow[] | null,
  name: UndoName,
) {
  const session = deck.undo.focused.current
  deck.undo.turnAfter(async () => {
    if (await applyRows(changingDeck(deck, session), plan, name)) {
      void flushPending(connect, deck.id).then(deck.settle)
      return
    }
    toast.error(designCopy.refused, { duration: Infinity, closeButton: true })
    deck.settle("refused")
  })
}
