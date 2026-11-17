import { resolveControl } from "@/design/panel-arrangement"
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
import { useId, useState } from "react"
import { designCopy } from "@/copy/design-copy"
import { tableCopy } from "@/copy/table-copy"
import { type ControlProps, type PanelControl } from "@/design/panel"
import { cn } from "@/lib/class-names"

type Cell = { readonly row: number; readonly column: number }

const scopes = ["cell", "row", "column", "table"] as const

type Scope = (typeof scopes)[number]

const thinBorder = 12_700

function CellPick({
  table,
  at,
  picked,
  onPick,
}: {
  table: TableValue
  at: Cell
  picked: boolean
  onPick: (cell: Cell) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 min-w-0 truncate rounded-[var(--shape-control)] bg-white px-2 text-[length:var(--type-dense)] text-foreground shadow-[0px_0px_0px_1px_var(--field-edge)]",
        picked && "shadow-[0_0_0_2px_var(--ring)]",
      )}
      aria-label={designCopy.cell(at.row + 1, at.column + 1)}
      aria-pressed={picked}
      data-picked={picked ? "" : undefined}
      onClick={() => onPick(at)}
    >
      {cellText(table.rows[at.row]?.cells[at.column] ?? [])}
    </button>
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

function partOf(control: PanelControl, field: string, label: string, desc: Desc, value: unknown): PanelControl {
  return resolveControl({ ...control, field, label, desc, value, mixed: false, reset: null })
}

export function TableControl({ control, palette, onChange, inner }: ControlProps) {
  const label = useId()
  const table = readTableValue(typeof control.value === "string" ? control.value : "")
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
            control: partOf(control, "cells", tableCopy.apply, { kind: "choice", options: scopes }, scope),
            onChange: (next: unknown) => setScope(next as Scope),
          },
          {
            control: partOf(
              control,
              "cellFill",
              tableCopy.cellFill,
              cellFill.desc,
              table.rows[at.row]?.fills?.[at.column],
            ),
            onChange: (next: unknown) =>
              changed({ change: "fill", cells: rangeOf(scope, at, table), fill: next as CellFill }),
          },
          {
            control: partOf(control, "borders", tableCopy.borders, { kind: "choice", options: borderSides }, sides),
            onChange: (next: unknown) => setSides(next as BorderSides),
          },
          {
            control: partOf(control, "borderFill", tableCopy.borderFill, borderKinds.fill.desc, border?.fill),
            onChange: (next: unknown) => bordered({ fill: next as CellFill }),
          },
          {
            control: partOf(control, "borderWidth", tableCopy.borderWidth, borderKinds.width.desc, border?.width),
            onChange: (next: unknown) => bordered({ width: next as number }),
          },
          {
            control: partOf(control, "borderDash", tableCopy.borderDash, borderKinds.dash.desc, border?.dash),
            onChange: (next: unknown) => bordered({ dash: next as Border["dash"] }),
          },
        ]

  return (
    <div className="flex flex-col gap-3" data-control="table">
      <div className="flex flex-col gap-1.5">
        <span id={label} className="text-[length:var(--type-caption)] text-quiet">
          {control.label}
        </span>
        <div
          role="group"
          aria-labelledby={label}
          className="-m-1 grid gap-1.5 overflow-x-auto p-1"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(4.5rem, 1fr))` }}
        >
          {table?.rows.flatMap((each, rowAt) =>
            each.cells.map((_, column) => (
              <CellPick
                key={`${String(rowAt)}.${String(column)}`}
                table={table}
                at={{ row: rowAt, column }}
                picked={at.row === rowAt && at.column === column}
                onPick={setPicked}
              />
            )),
          )}
        </div>
      </div>
      {parts.map((part) => (
        <div key={part.control.field}>
          {inner?.({ control: part.control, palette, onChange: part.onChange, inner })}
        </div>
      ))}
    </div>
  )
}
