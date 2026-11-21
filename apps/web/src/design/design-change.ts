import type { Bound, Command, ElementId, Place, PlacedRow, Register, SetChange } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import { fileChartFormats, fileChartValue, readShapes, type ReadShape } from "@airdesign/pptx"
import { toast } from "@/components/ui/toast"
import { flushPending, type CommitOutcome } from "@/commit-edit"
import { designCopy } from "@/copy/design-copy"
import { applyChange, applyRows, changeAhead, rowsAhead, valueFits, type ChangingDeck } from "@/design/trait-edit"
import type { UndoName } from "@/copy/undo-copy"
import type { DeckPaint } from "@/editor/use-deck-paint"
import type { UndoList } from "@/editor/use-undo"
import { withFileFloors } from "@/deck-paint"
import { fileTableValue } from "@/table-edit"
import { structureOf } from "@/table-hook"
import type { RecordHold } from "@/undo-list"

export type DesignDeck = {
  readonly id: string
  readonly shown: DeckPaint
  readonly undo: UndoList
  readonly settle: (outcome: CommitOutcome) => void
}

const fileShapes = new WeakMap<ReadonlyMap<string, Uint8Array>, ReadonlyMap<string, ReadShape>>()

function fileShape(parts: ReadonlyMap<string, Uint8Array>, node: ElementId): ReadShape | undefined {
  let shapes = fileShapes.get(parts)
  if (shapes === undefined) {
    shapes = new Map(readShapes(parts).map((shape) => [`${shape.slide}.${shape.shape}`, shape]))
    fileShapes.set(parts, shapes)
  }
  return shapes.get(node)
}

export function fileChartFormatsOf(shown: DeckPaint, node: ElementId): readonly string[] {
  const parts = shown.editParts.current
  const shape = shown.shapes.current.get(node) ?? fileShape(parts, node)
  return shape?.contentKind === "chart" ? (fileChartFormats(parts, shape.part, shape.shape) ?? []) : []
}

export function fileValue(shown: DeckPaint, node: ElementId): string | null {
  const parts = shown.editParts.current
  const shape = shown.shapes.current.get(node) ?? fileShape(parts, node)
  if (shape?.contentKind === "chart") return fileChartValue(parts, shape.part, shape.shape)
  return shape?.contentKind === "table" ? fileTableValue(shown.editParts.current, shape) : null
}

function changingDeck(deck: DesignDeck): ChangingDeck {
  const { shown } = deck
  return {
    id: deck.id,
    parts: () => shown.shownParts.current,
    floor: (node) => shown.boxes.current.get(node)?.file ?? shown.movables.current.get(node)?.file ?? "",
    file: (node) => fileValue(shown, node),
    fits: (node, value) =>
      valueFits(
        shown.editParts.current,
        shown.shapes.current.get(node) ?? fileShape(shown.editParts.current, node),
        value,
      ),
    show: (register) => {
      const framed = withFileFloors(shown.paintedOf(register), shown.shownParts.current)
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

function paintedAhead(deck: DesignDeck, commands: (register: Register) => readonly Command[] | null): () => void {
  const register = deck.shown.shownRegister.current
  const ahead = register === null ? null : commands(register)
  return ahead === null ? () => undefined : deck.shown.ahead.paint(ahead)
}

async function showDevice(deck: DesignDeck, changing: ChangingDeck) {
  const opened = await connect(memoryRemote()).openDeck(deck.id)
  if (opened.ok) changing.show(opened.register)
}

export function changeDesign(
  deck: DesignDeck,
  change: () => SetChange | readonly SetChange[],
  afterPaint?: () => void,
  onRefused?: () => void,
) {
  const changing = changingDeck(deck)
  const asked = change()
  storeDesign(
    deck,
    changing,
    (register) => changeAhead(changing, register, asked),
    (slot, written) => applyChange(changing, asked, written, slot),
    afterPaint,
    onRefused,
  )
}

export function changeRows(
  deck: DesignDeck,
  plan: (register: Register) => readonly PlacedRow[] | null,
  name: UndoName,
) {
  const changing = changingDeck(deck)
  storeDesign(
    deck,
    changing,
    (register) => rowsAhead(changing, register, plan),
    (slot, written) => applyRows(changing, plan, name, written, slot),
  )
}

function storeDesign(
  deck: DesignDeck,
  changing: ChangingDeck,
  commands: (register: Register) => readonly Command[] | null,
  store: (slot: RecordHold, written: () => void) => Promise<boolean>,
  afterPaint?: () => void,
  onRefused?: () => void,
) {
  const session = deck.undo.focused.current
  const records = deck.undo.records.current
  const earlier = records.landed()
  const slot = records.hold()
  const named: RecordHold = {
    record: (entry) => slot.record(session === null ? entry : { ...entry, session }),
    release: slot.release,
  }
  const written = paintedAhead(deck, commands)
  deck.undo.turnAfter(async () => {
    try {
      await earlier
      if (await store(named, written)) {
        afterPaint?.()
        void flushPending(connect, deck.id).then(deck.settle)
        return
      }
    } finally {
      written()
      slot.release()
    }
    await showDevice(deck, changing)
    onRefused?.()
    toast.error(designCopy.refused, { duration: Infinity, closeButton: true })
    deck.settle("refused")
  })
}
