import { currentValue, openingElement, type ElementId, type Register, type TableChange } from "@airdesign/document"
import { connect, memoryRemote } from "@airdesign/live"
import type { ReadShape } from "@airdesign/pptx"
import type { CanvasSlide, TableBar } from "@airdesign/render"
import { createElement, useRef, type RefObject } from "react"
import { commitEdit, type CommitOutcome, type TextBox } from "@/commit-edit"
import type { ElementChange } from "@/element-edit"
import { TableRowBar } from "@/editor/table-bar"
import { tableValue } from "@/table-edit"
import type { UndoEntry } from "@/undo-list"

type Parts = ReadonlyMap<string, Uint8Array>

export type TableDeck = {
  readonly id: string
  readonly current: number
  readonly boxes: RefObject<ReadonlyMap<ElementId, TextBox>>
  readonly shapes: RefObject<ReadonlyMap<ElementId, ReadShape>>
  readonly editParts: RefObject<Parts>
  readonly canvases: RefObject<(index: number) => CanvasSlide | null>
  readonly record: (entry: UndoEntry) => void
  readonly settle: (outcome: CommitOutcome) => void
  readonly showEdited: (index: number) => Promise<void>
  readonly changeElement: (change: ElementChange) => Promise<void>
}

const typedRepaint = 400

const tableBar: TableBar = (table) => createElement(TableRowBar, table)

export function structureOf(register: Register | null): string {
  if (register === null) return "[]"
  const tables = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return value.startsWith('{"rows"') ? [[node, value]] : []
  })
  return JSON.stringify(tables.length === 0 ? register.order : [register.order, tables])
}

function shownBefore(register: Register, id: ElementId, file: string): string {
  const body = register.elements[id]
  if (body !== undefined && register.nodes.includes(id)) return currentValue(body)
  return openingElement(register, id)?.value ?? file
}

export function useTables(deck: TableDeck) {
  const queue = useRef(Promise.resolve())
  const typing = useRef<{ readonly cell: string; readonly session: number } | null>(null)
  const sessions = useRef(0)
  const repaint = useRef<number | undefined>(undefined)
  const latest = useRef(deck)
  latest.current = deck

  async function commit(id: ElementId, change: TableChange) {
    const box = deck.boxes.current.get(id)
    const shape = deck.shapes.current.get(id)
    const opened = await connect(memoryRemote()).openDeck(deck.id)
    if (box === undefined || shape === undefined || !opened.ok) return
    const value = tableValue(deck.editParts.current, shape, opened.register, change)
    if (value === null) {
      if (change.change !== "cell") await deck.showEdited(deck.current)
      return
    }
    const before = shownBefore(opened.register, id, box.file)
    const cell = change.change === "cell" ? `${id}#${change.row}.${change.column}` : null
    if (cell === null || typing.current?.cell !== cell) {
      sessions.current += 1
      typing.current = cell === null ? null : { cell, session: sessions.current }
    }
    const name = change.change === "cell" ? "text" : change.change === "row" ? "add-row" : "delete-row"
    const undoable = { node: id, floor: box.file, before: { value: before }, after: { value } }
    const outcome = await commitEdit(connect, deck.id, value, box, () =>
      deck.record({ name, undoable, ...(cell === null ? {} : { session: sessions.current }) }),
    )
    window.clearTimeout(repaint.current)
    if (cell === null || outcome === "refused") await deck.showEdited(deck.current)
    else repaint.current = window.setTimeout(() => void latest.current.showEdited(latest.current.current), typedRepaint)
    deck.settle(outcome)
  }

  return {
    insert() {
      const slide = deck.canvases.current(deck.current)
      if (slide === null) return
      const taken = slide.elements.flatMap((element) =>
        element.box === null
          ? []
          : [{ x: element.box.x, y: element.box.y, cx: element.box.width, cy: element.box.height }],
      )
      void deck.changeElement({ change: "table", index: deck.current, size: slide, taken })
    },
    canvas: {
      tableBar,
      onTable(id: ElementId, change: TableChange) {
        queue.current = queue.current.then(() => commit(id, change))
      },
    },
  }
}
