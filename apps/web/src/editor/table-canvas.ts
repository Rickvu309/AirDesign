import type { CellRange, ElementId, TableChange } from "@airdesign/document"
import type { CommitOutcome } from "@/commit-edit"
import { tableCopy } from "@/copy/table-copy"
import type { UndoName } from "@/copy/undo-copy"
import type { useTables } from "@/table-hook"

export type TableCanvasDeck = {
  readonly tables?: ReturnType<typeof useTables>
  readonly onCells?: (node: ElementId, cells: CellRange | null) => void
}

export function tableCanvas(
  deck: TableCanvasDeck,
  edit: (target: ElementId, value: string, name: UndoName) => Promise<CommitOutcome>,
) {
  const { tables, onCells } = deck
  if (tables === undefined) return {}
  return {
    tableWords: tableCopy,
    ...(onCells === undefined ? {} : { onCells }),
    onTable: (target: ElementId, change: TableChange) =>
      tables.change(target, change, (value, name) => edit(target, value, name)),
  }
}
