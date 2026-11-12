import type { TableChange } from "@airdesign/document"
import { Button } from "@/components/ui/button"
import { tableCopy } from "@/copy/table-copy"
import { floatShadow } from "@/editor/editor-chrome"
import { cn } from "@/lib/class-names"

export function TableRowBar({
  row,
  rows,
  change,
}: {
  row: number
  rows: number
  change: (change: TableChange) => void
}) {
  const actions = [
    { label: tableCopy.rowAbove, run: () => change({ change: "row", row, place: "above" }), off: false },
    { label: tableCopy.rowBelow, run: () => change({ change: "row", row, place: "below" }), off: false },
    { label: tableCopy.deleteRow, run: () => change({ change: "remove-row", row }), off: rows < 2 },
  ]
  return (
    <div
      role="toolbar"
      aria-label={tableCopy.rows}
      className={cn("flex items-center gap-0.5 rounded-lg bg-white p-1 whitespace-nowrap", floatShadow)}
    >
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          variant="ghost"
          size="sm"
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
