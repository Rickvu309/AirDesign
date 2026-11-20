import type { ElementId, TableChange } from "@airdesign/document"
import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import type { CanvasTable } from "./record.js"
import type { Scaled } from "./text-look.js"

export type TableWords = {
  readonly addRow: string
  readonly addColumn: string
  readonly insertRow: (row: number) => string
  readonly insertColumn: (column: number) => string
  readonly row: (row: number) => string
  readonly column: (column: number) => string
}

export type TableEditing = {
  readonly onTable?: ((id: ElementId, change: TableChange) => void) | undefined
  readonly tableWords?: TableWords | undefined
}

export type TablePick = { readonly kind: "row" | "column"; readonly at: number }

export type TableSizing =
  | { readonly kind: "column"; readonly sizes: readonly number[] }
  | { readonly kind: "row"; readonly sizes: readonly number[] }

type Box = { readonly width: number; readonly height: number }

export type TableHandles = {
  readonly table: CanvasTable
  readonly box: Box | null
  readonly scaled: Scaled
  readonly words: TableWords
  readonly picked: TablePick | null
  readonly onPick: (pick: TablePick | null) => void
  readonly onSizing: (sizing: TableSizing | null) => void
  readonly change: (change: TableChange) => void
  readonly leave: () => void
}

const ring = "var(--ring)"
const reach = 14
const grip = 6
const smallestColumn = 152_400
const smallestRow = 76_200

const quiet = (event: PointerEvent<HTMLElement>) => event.stopPropagation()

export function sizedTable(table: CanvasTable, sizing: TableSizing | null): CanvasTable {
  if (sizing === null) return table
  if (sizing.kind === "column") return { ...table, columns: sizing.sizes }
  return { ...table, rows: table.rows.map((row, at) => ({ ...row, height: sizing.sizes[at] ?? row.height })) }
}

function Plus(props: { readonly style: CSSProperties; readonly label: string; readonly run: () => void }) {
  const [near, setNear] = useState(false)
  return (
    <button
      type="button"
      aria-label={props.label}
      data-table-plus
      onPointerDown={quiet}
      onPointerEnter={() => setNear(true)}
      onPointerLeave={() => setNear(false)}
      onFocus={() => setNear(true)}
      onBlur={() => setNear(false)}
      onClick={props.run}
      style={{
        position: "absolute",
        width: 16,
        height: 16,
        padding: 0,
        border: "none",
        borderRadius: 8,
        background: ring,
        color: "white",
        font: "600 12px/16px sans-serif",
        cursor: "pointer",
        opacity: near ? 1 : 0,
        zIndex: 4,
        ...props.style,
      }}
    >
      +
    </button>
  )
}

function moved(sizes: readonly number[], at: number, by: number, least: number): readonly number[] {
  const first = sizes[at] ?? 0
  const second = sizes[at + 1] ?? 0
  const shift = Math.max(least - first, Math.min(second - least, by))
  return sizes.map((size, index) => (index === at ? first + shift : index === at + 1 ? second - shift : size))
}

function Border(props: { readonly kind: "row" | "column"; readonly at: number; readonly handles: TableHandles }) {
  const { kind, at, handles } = props
  const { table, box, scaled } = handles
  const [start, setStart] = useState<{ readonly from: number; readonly sizes: readonly number[] } | null>(null)
  const [last, setLast] = useState<readonly number[] | null>(null)
  const sizes = kind === "column" ? table.columns : table.rows.map((row) => row.height)
  const total =
    (kind === "column" ? table.frame?.width : table.frame?.height) ?? sizes.reduce((sum, size) => sum + size, 0)
  const shown = (kind === "column" ? box?.width : box?.height) ?? total
  const perPixel = scaled(shown) === 0 ? 0 : total / scaled(shown)
  const least = Math.round(((kind === "column" ? smallestColumn : smallestRow) * total) / Math.max(shown, 1))
  const spot = (event: PointerEvent<HTMLElement>) => (kind === "column" ? event.clientX : event.clientY)
  const style: CSSProperties =
    kind === "column"
      ? { top: 0, bottom: 0, right: -grip / 2, width: grip, cursor: "col-resize" }
      : { left: 0, right: 0, bottom: -grip / 2, height: grip, cursor: "row-resize" }
  return (
    <div
      {...(kind === "column" ? { "data-column-border": String(at) } : { "data-row-border": String(at) })}
      style={{ position: "absolute", zIndex: 2, touchAction: "none", ...style }}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.preventDefault()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setStart({ from: spot(event), sizes })
      }}
      onPointerMove={(event) => {
        if (start === null) return
        const next = moved(start.sizes, at, Math.round((spot(event) - start.from) * perPixel), least)
        setLast(next)
        handles.onSizing({ kind, sizes: next })
      }}
      onPointerUp={() => {
        const next = last
        setStart(null)
        setLast(null)
        handles.onSizing(null)
        if (next === null || start === null || next.every((size, index) => size === start.sizes[index])) return
        handles.change(kind === "column" ? { change: "widths", widths: next } : { change: "heights", heights: next })
      }}
    />
  )
}

function Handle(props: { readonly pick: TablePick; readonly handles: TableHandles }) {
  const { pick, handles } = props
  const on = handles.picked?.kind === pick.kind && handles.picked.at === pick.at
  const label = pick.kind === "row" ? handles.words.row(pick.at + 1) : handles.words.column(pick.at + 1)
  const rows = handles.table.rows.length
  const columns = handles.table.columns.length
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      handles.onPick(null)
      handles.leave()
      return
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return
    event.preventDefault()
    event.stopPropagation()
    if (pick.kind === "row" ? rows < 2 : columns < 2) return
    handles.onPick(null)
    handles.change(
      pick.kind === "row" ? { change: "remove-row", row: pick.at } : { change: "remove-column", column: pick.at },
    )
  }
  const place: CSSProperties =
    pick.kind === "row"
      ? { left: -reach, top: 0, bottom: 0, width: reach - 2 }
      : { top: -reach, left: 0, right: 0, height: reach - 2 }
  const pill: CSSProperties = pick.kind === "row" ? { width: 4, height: 16 } : { width: 16, height: 4 }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      data-table-handle={pick.kind}
      onPointerDown={quiet}
      onClick={() => handles.onPick(pick)}
      onKeyDown={key}
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        zIndex: 3,
        ...place,
      }}
    >
      <span aria-hidden style={{ borderRadius: 2, background: on ? ring : "var(--field-edge)", ...pill }} />
    </button>
  )
}

export function cellHandles(row: number, column: number, handles: TableHandles): ReactNode {
  const { table, words, picked, change } = handles
  const lastRow = table.rows.length - 1
  const lastColumn = table.columns.length - 1
  const tinted = picked !== null && (picked.kind === "row" ? picked.at === row : picked.at === column)
  const across = picked?.kind === "row"
  const edges = [
    across || row === 0 ? `inset 0 2px 0 ${ring}` : null,
    across || row === lastRow ? `inset 0 -2px 0 ${ring}` : null,
    !across || column === 0 ? `inset 2px 0 0 ${ring}` : null,
    !across || column === lastColumn ? `inset -2px 0 0 ${ring}` : null,
  ].filter((edge) => edge !== null)
  return (
    <>
      {tinted ? (
        <div
          data-table-picked
          aria-hidden
          style={{ position: "absolute", inset: 0, boxShadow: edges.join(", "), pointerEvents: "none" }}
        />
      ) : null}
      {row === 0 ? <Handle pick={{ kind: "column", at: column }} handles={handles} /> : null}
      {column === 0 ? <Handle pick={{ kind: "row", at: row }} handles={handles} /> : null}
      {row === 0 && column < lastColumn ? (
        <Plus
          style={{ top: -reach - 2, right: -8 }}
          label={words.insertColumn(column + 1)}
          run={() => change({ change: "column", column, place: "after" })}
        />
      ) : null}
      {column === 0 && row < lastRow ? (
        <Plus
          style={{ left: -reach - 2, bottom: -8 }}
          label={words.insertRow(row + 1)}
          run={() => change({ change: "row", row, place: "below" })}
        />
      ) : null}
      {column < lastColumn ? <Border kind="column" at={column} handles={handles} /> : null}
      {row < lastRow ? <Border kind="row" at={row} handles={handles} /> : null}
    </>
  )
}

function EdgeBar(props: { readonly label: string; readonly style: CSSProperties; readonly run: () => void }) {
  const [near, setNear] = useState(false)
  return (
    <button
      type="button"
      aria-label={props.label}
      data-table-edge
      onPointerDown={quiet}
      onPointerEnter={() => setNear(true)}
      onPointerLeave={() => setNear(false)}
      onFocus={() => setNear(true)}
      onBlur={() => setNear(false)}
      onClick={props.run}
      style={{
        position: "absolute",
        padding: 0,
        border: "none",
        borderRadius: 4,
        background: ring,
        opacity: near ? 1 : 0,
        color: "white",
        font: "600 12px/12px sans-serif",
        cursor: "pointer",
        zIndex: 3,
        ...props.style,
      }}
    >
      +
    </button>
  )
}

export function edgeBars(handles: TableHandles): ReactNode {
  const { table, words, change } = handles
  return (
    <>
      <EdgeBar
        label={words.addColumn}
        style={{ left: "calc(100% + 6px)", top: 0, height: "100%", width: 12 }}
        run={() => change({ change: "column", column: table.columns.length - 1, place: "after" })}
      />
      <EdgeBar
        label={words.addRow}
        style={{ top: "calc(100% + 6px)", left: 0, width: "100%", height: 12 }}
        run={() => change({ change: "row", row: table.rows.length - 1, place: "below" })}
      />
    </>
  )
}
