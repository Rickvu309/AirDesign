import {
  currentBox,
  currentValue,
  openingElement,
  type ElementId,
  type Register,
  type TableChange,
} from "@airdesign/document"
import type { ReadShape } from "@airdesign/pptx"
import type { CanvasSlide, PaintStore, TableBar } from "@airdesign/render"
import { createElement, useRef, type RefObject } from "react"
import type { CommitOutcome } from "@/commit-edit"
import type { ElementChange } from "@/element-edit"
import { designRows } from "@/design-rows"
import { TableRowBar } from "@/editor/table-bar"
import { tableValue } from "@/table-edit"
import type { UndoName } from "@/copy/undo-copy"

type Parts = ReadonlyMap<string, Uint8Array>

export type TableDeck = {
  readonly current: number
  readonly store: RefObject<PaintStore>
  readonly shapes: RefObject<ReadonlyMap<ElementId, ReadShape>>
  readonly editParts: RefObject<Parts>
  readonly canvases: RefObject<(index: number) => CanvasSlide | null>
  readonly showEdited: (index: number, whole?: "whole") => Promise<void>
  readonly changeElement: (change: ElementChange) => Promise<CommitOutcome | "closed">
}

const typedRepaint = 400

const tableBar: TableBar = (table) => createElement(TableRowBar, table)

const nothingBound: ReadonlySet<string> = new Set()

export function structureOf(register: Register | null, bound: ReadonlySet<string> = nothingBound): string {
  if (register === null) return "[]"
  const tables = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return value.startsWith('{"rows"') ? [[node, value]] : []
  })
  const designed = designRows(register)
  const followed = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    return body === undefined || !bound.has(node) ? [] : [[node, currentBox(body)]]
  })
  if (followed.length > 0) return JSON.stringify([register.order, tables, designed, followed])
  if (designed.length > 0) return JSON.stringify([register.order, tables, designed])
  return JSON.stringify(tables.length === 0 ? register.order : [register.order, tables])
}

export function shownTable(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && register?.nodes.includes(id) === true) return currentValue(body)
  return (register === null ? undefined : openingElement(register, id)?.value) ?? file
}

const editNames: Readonly<Record<TableChange["change"], UndoName>> = {
  cell: "text",
  row: "add-row",
  "remove-row": "delete-row",
  column: "add-column",
  "remove-column": "delete-column",
  fill: "cell-fill",
  border: "border",
}

export type TableEdit = (value: string, name: UndoName) => Promise<CommitOutcome>

export function useTables(deck: TableDeck) {
  const repaint = useRef<number | undefined>(undefined)
  const latest = useRef(deck)
  latest.current = deck

  function showLatest(whole?: "whole") {
    void latest.current.showEdited(latest.current.current, whole)
  }

  return {
    insert() {
      const slide = deck.canvases.current(deck.current)
      if (slide !== null) void deck.changeElement({ change: "table", index: deck.current, size: slide })
    },
    tableBar,
    change(id: ElementId, change: TableChange, edit: TableEdit) {
      const shape = deck.shapes.current.get(id)
      const shown = deck.store.current.getElement(id)?.text ?? null
      const value = shape === undefined ? null : tableValue(deck.editParts.current, shape, shown, change)
      if (value === null) {
        if (change.change !== "cell") showLatest("whole")
        return
      }
      void edit(value, editNames[change.change]).then((outcome) => {
        window.clearTimeout(repaint.current)
        if (outcome === "refused") showLatest("whole")
        else if (change.change !== "cell") showLatest()
        else repaint.current = window.setTimeout(() => showLatest(), typedRepaint)
      })
    },
  }
}
