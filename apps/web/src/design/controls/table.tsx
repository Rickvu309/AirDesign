import {
  borderKinds,
  borderSides,
  cellFill,
  cellText,
  changedTable,
  readTableValue,
  writeTableValue,
  type Border,
  type BorderSides,
  type CellFill,
  type CellRange,
  type Desc,
  type TableChange,
  type TableSide,
  type TableValue,
} from "@airdesign/document"
import { useId, useState, type KeyboardEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import { tableCopy } from "@/copy/table-copy"
import { controlOf, type ControlProps, type PanelRow } from "@/design/panel"
import { cn } from "@/lib/class-names"

type Cell = { readonly row: number; readonly column: number }

const scopes = ["cell", "row", "column", "table"] as const

type Scope = (typeof scopes)[number]

const thinBorder = 12_700

function CellInput({
  table,
  at,
  picked,
  onPick,
  onChange,
}: {
  table: TableValue
  at: Cell
  picked: boolean
  onPick: (cell: Cell) => void
  onChange: (value: unknown) => void
}) {
  const cell = table.rows[at.row]?.cells[at.column] ?? []
  const shown = cellText(cell)
  const [draft, setDraft] = useState<string | null>(null)

  function commit(text: string) {
    setDraft(null)
    if (text === shown) return
    const next = changedTable(table, { change: "cell", row: at.row, column: at.column, text })
    if (next !== null) onChange(writeTableValue(next))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit(event.currentTarget.value)
    if (event.key === "Escape") setDraft(null)
  }

  return (
    <input
      className={cn(
        "h-8 min-w-0 rounded-[var(--shape-control)] bg-white px-2 text-[length:var(--type-dense)] text-foreground shadow-[0px_0px_0px_1px_var(--field-edge)]",
        picked && "shadow-[0_0_0_2px_var(--ring)]",
      )}
      aria-label={designCopy.cell(at.row + 1, at.column + 1)}
      data-picked={picked ? "" : undefined}
      value={draft ?? shown}
      onFocus={() => onPick(at)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (draft !== null) commit(event.currentTarget.value)
      }}
      onKeyDown={onKeyDown}
    />
  )
}

function rangeOf(scope: Scope, at: Cell, table: TableValue): CellRange {
  const last = (count: number) => Math.max(count - 1, 0)
  const rows = scope === "column" || scope === "table" ? ([0, last(table.rows.length)] as const) : [at.row, at.row]
  const columns = table.rows[0]?.cells.length ?? 0
  return {
    rows: [rows[0], rows[1]],
    columns: scope === "row" || scope === "table" ? [0, last(columns)] : [at.column, at.column],
  }
}

function shownSide(sides: BorderSides): TableSide {
  return sides === "top" || sides === "left" || sides === "right" ? sides : "bottom"
}

function partOf(row: PanelRow, field: string, label: string, desc: Desc, value: unknown): PanelRow {
  return { ...row, field, label, control: controlOf(desc), desc, value, mixed: false, caption: true, reset: null }
}

export function TableControl({ row, palette, onChange, inner }: ControlProps) {
  const label = useId()
  const table = readTableValue(typeof row.value === "string" ? row.value : "")
  const columns = table?.rows[0]?.cells.length ?? 0
  const [picked, setPicked] = useState<Cell>({ row: 0, column: 0 })
  const [scope, setScope] = useState<Scope>("cell")
  const [sides, setSides] = useState<BorderSides>("all")
  const at = {
    row: Math.min(picked.row, Math.max((table?.rows.length ?? 1) - 1, 0)),
    column: Math.min(picked.column, Math.max(columns - 1, 0)),
  }
  const border: Border | undefined = table?.rows[at.row]?.borders?.[at.column]?.[shownSide(sides)]

  function changed(change: TableChange) {
    const next = table === null ? null : changedTable(table, change)
    if (next !== null && next !== table) onChange(writeTableValue(next))
  }

  function bordered(part: Border) {
    if (table === null) return
    const width = part.width === undefined && border?.width === undefined ? { width: thinBorder } : {}
    changed({ change: "border", cells: rangeOf(scope, at, table), sides, border: { ...width, ...part } })
  }

  const parts =
    table === null || inner === undefined
      ? []
      : [
          {
            row: partOf(row, "cells", tableCopy.apply, { kind: "choice", options: scopes }, scope),
            onChange: (next: unknown) => setScope(next as Scope),
          },
          {
            row: partOf(row, "cellFill", tableCopy.cellFill, cellFill.desc, table.rows[at.row]?.fills?.[at.column]),
            onChange: (next: unknown) =>
              changed({ change: "fill", cells: rangeOf(scope, at, table), fill: next as CellFill }),
          },
          {
            row: partOf(row, "borders", tableCopy.borders, { kind: "choice", options: borderSides }, sides),
            onChange: (next: unknown) => setSides(next as BorderSides),
          },
          {
            row: partOf(row, "borderFill", tableCopy.borderFill, borderKinds.fill.desc, border?.fill),
            onChange: (next: unknown) => bordered({ fill: next as CellFill }),
          },
          {
            row: partOf(row, "borderWidth", tableCopy.borderWidth, borderKinds.width.desc, border?.width),
            onChange: (next: unknown) => bordered({ width: next as number }),
          },
          {
            row: partOf(row, "borderDash", tableCopy.borderDash, borderKinds.dash.desc, border?.dash),
            onChange: (next: unknown) => bordered({ dash: next as Border["dash"] }),
          },
        ]

  return (
    <div className="flex flex-col gap-3" data-control="table">
      <div className="flex flex-col gap-1.5">
        <span id={label} className="text-[length:var(--type-caption)] text-quiet">
          {row.label}
        </span>
        <div
          role="group"
          aria-labelledby={label}
          className="-m-1 grid gap-1.5 overflow-x-auto p-1"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(4.5rem, 1fr))` }}
        >
          {table?.rows.flatMap((each, rowAt) =>
            each.cells.map((_, column) => (
              <CellInput
                key={`${String(rowAt)}.${String(column)}`}
                table={table}
                at={{ row: rowAt, column }}
                picked={at.row === rowAt && at.column === column}
                onPick={setPicked}
                onChange={onChange}
              />
            )),
          )}
        </div>
      </div>
      {parts.map((part) => (
        <div key={part.row.field}>{inner?.({ row: part.row, palette, onChange: part.onChange, inner })}</div>
      ))}
    </div>
  )
}
