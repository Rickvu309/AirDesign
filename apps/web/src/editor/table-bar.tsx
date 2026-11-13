import type { TableChange } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { tableCopy } from "@/copy/table-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { cn } from "@/lib/class-names"

type Action = { readonly label: string; readonly name: string; readonly run: () => void; readonly off: boolean }

function TableActions({ label, actions }: { label: string; actions: readonly Action[] }) {
  return (
    <div role="toolbar" aria-label={label} className="flex items-center gap-0.5">
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={action.name}
          disabled={action.off}
          onClick={action.run}
          className="h-7 rounded-md px-2 text-xs text-foreground active:translate-y-0"
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}

export function TableRowBar({
  row,
  rows,
  column,
  columns,
  change,
}: {
  row: number
  rows: number
  column: number
  columns: number
  change: (change: TableChange) => void
}) {
  const rowActions = [
    {
      label: tableCopy.rowAbove,
      name: tableCopy.rowAboveOf(row + 1),
      run: () => change({ change: "row", row, place: "above" }),
      off: false,
    },
    {
      label: tableCopy.rowBelow,
      name: tableCopy.rowBelowOf(row + 1),
      run: () => change({ change: "row", row, place: "below" }),
      off: false,
    },
    {
      label: tableCopy.deleteRow,
      name: tableCopy.deleteRowOf(row + 1),
      run: () => change({ change: "remove-row", row }),
      off: rows < 2,
    },
  ]
  const columnActions = [
    {
      label: tableCopy.columnLeft,
      name: tableCopy.columnLeftOf(column + 1),
      run: () => change({ change: "column", column, place: "before" }),
      off: false,
    },
    {
      label: tableCopy.columnRight,
      name: tableCopy.columnRightOf(column + 1),
      run: () => change({ change: "column", column, place: "after" }),
      off: false,
    },
    {
      label: tableCopy.deleteColumn,
      name: tableCopy.deleteColumnOf(column + 1),
      run: () => change({ change: "remove-column", column }),
      off: columns < 2,
    },
  ]
  return (
    <div className={cn("flex items-center gap-0.5 rounded-lg bg-white p-1 whitespace-nowrap", floatShadow)}>
      <TableActions label={tableCopy.rows} actions={rowActions} />
      <span aria-hidden className="mx-1 block h-5 w-px bg-[var(--field-edge)]" />
      <TableActions label={tableCopy.columns} actions={columnActions} />
    </div>
  )
}
