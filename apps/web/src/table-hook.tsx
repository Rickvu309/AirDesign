import {
  currentBox,
  currentValue,
  groupedNow,
  measureStale,
  openingElement,
  type ElementId,
  type Register,
  type TableChange,
} from "@airdesign/document"
import type { ReadShape } from "@airdesign/pptx"
import type { PaintStore } from "@airdesign/render"
import { useRef, type RefObject } from "react"
import type { CommitOutcome } from "@/commit-edit"
import type { UndoName } from "@/copy/undo-copy"
import { designRows } from "@/design-rows"
import { imageTexts } from "@/patch-images"
import { tableValue } from "@/table-edit"

const nothingBound: ReadonlySet<string> = new Set()

function resized(register: Register): readonly (readonly [ElementId, number, number])[] {
  return register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const floor = body?.floorBox
    if (body === undefined || floor === undefined) return []
    const box = currentBox(body)
    if (box === null || (box.cx === floor.cx && box.cy === floor.cy)) return []
    return [[node, box.cx, box.cy]]
  })
}

function inGroupOrGroup(register: Register, node: ElementId): boolean {
  return groupedNow(register, node) || openingElement(register, node)?.kind === "group"
}

export function structureOf(register: Register | null, bound: ReadonlySet<string> = nothingBound): string {
  if (register === null) return "[]"
  const tables = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const value = body === undefined ? "" : currentValue(body)
    return value.startsWith('{"rows"') ? [[node, value]] : []
  })
  const designed = [...designRows(register), ...imageTexts(register)]
  const followed = register.nodes.flatMap((node) => {
    const body = register.elements[node]
    const placedByPaint = bound.has(node) || inGroupOrGroup(register, node)
    return body === undefined || !placedByPaint ? [] : [[node, currentBox(body)]]
  })
  const sizes = [...resized(register), ...measureStale(register)]
  if (sizes.length > 0) return JSON.stringify([register.order, tables, designed, followed, sizes])
  if (followed.length > 0) return JSON.stringify([register.order, tables, designed, followed])
  if (designed.length > 0) return JSON.stringify([register.order, tables, designed])
  return JSON.stringify(tables.length === 0 ? register.order : [register.order, tables])
}

export function shownTable(register: Register | null, id: ElementId, file: string): string {
  const body = register?.elements[id]
  if (body !== undefined && register?.nodes.includes(id) === true) return currentValue(body)
  return (register === null ? undefined : openingElement(register, id)?.value) ?? file
}

export type TableDeck = {
  readonly current: number
  readonly store: RefObject<PaintStore>
  readonly shapes: RefObject<ReadonlyMap<ElementId, ReadShape>>
  readonly editParts: RefObject<ReadonlyMap<string, Uint8Array>>
  readonly showEdited: (index: number, whole?: "whole") => Promise<void>
}

export type TableEdit = (value: string, name: UndoName) => Promise<CommitOutcome>

const typedRepaint = 400

const editNames: Readonly<Record<TableChange["change"], UndoName>> = {
  cell: "text",
  row: "add-row",
  "remove-row": "delete-row",
  column: "add-column",
  "remove-column": "delete-column",
  fill: "cell-fill",
  border: "border",
  widths: "resize",
  heights: "resize",
}

export function useTables(deck: TableDeck) {
  const repaint = useRef<number | undefined>(undefined)
  const latest = useRef(deck)
  latest.current = deck

  function showLatest(whole?: "whole") {
    void latest.current.showEdited(latest.current.current, whole)
  }

  return {
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
        if (outcome === "refused" || outcome === "too-large") showLatest("whole")
        else if (change.change !== "cell") showLatest()
        else repaint.current = window.setTimeout(() => showLatest(), typedRepaint)
      })
    },
  }
}
