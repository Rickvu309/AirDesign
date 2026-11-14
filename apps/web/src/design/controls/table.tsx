import { cellText, changedTable, readTableValue, writeTableValue, type TableValue } from "@airdesign/document"
import { useId, useState, type KeyboardEvent } from "react"
import { designCopy } from "@/copy/design-copy"
import type { ControlProps } from "@/design/panel"

type Cell = { readonly row: number; readonly column: number }

function CellInput({ table, at, onChange }: { table: TableValue; at: Cell; onChange: (value: unknown) => void }) {
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
      className="h-8 min-w-0 rounded-[var(--shape-control)] bg-white px-2 text-[length:var(--type-dense)] text-foreground shadow-[0px_0px_0px_1px_var(--field-edge)]"
      aria-label={designCopy.cell(at.row + 1, at.column + 1)}
      value={draft ?? shown}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        if (draft !== null) commit(event.currentTarget.value)
      }}
      onKeyDown={onKeyDown}
    />
  )
}

export function TableControl({ row, onChange }: ControlProps) {
  const label = useId()
  const table = readTableValue(typeof row.value === "string" ? row.value : "")
  const columns = table?.rows[0]?.cells.length ?? 0
  return (
    <div className="flex flex-col gap-1.5" data-control="table">
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
              onChange={onChange}
            />
          )),
        )}
      </div>
    </div>
  )
}
