import type { TableSize } from "@/element-edit"

export const most: TableSize = { rows: 8, columns: 10 }
export const first: TableSize = { rows: 1, columns: 1 }
export const counts = (count: number) => Array.from({ length: count }, (_, at) => at + 1)

function within(value: number, top: number): number {
  return Math.min(Math.max(value, 1), top)
}

export function movedSize(at: TableSize, key: string): TableSize | null {
  switch (key) {
    case "ArrowDown":
      return { rows: within(at.rows + 1, most.rows), columns: at.columns }
    case "ArrowUp":
      return { rows: within(at.rows - 1, most.rows), columns: at.columns }
    case "ArrowRight":
      return { rows: at.rows, columns: within(at.columns + 1, most.columns) }
    case "ArrowLeft":
      return { rows: at.rows, columns: within(at.columns - 1, most.columns) }
    case "Home":
      return { rows: at.rows, columns: 1 }
    case "End":
      return { rows: at.rows, columns: most.columns }
    default:
      return null
  }
}
