const counted = (count: number, one: string) => `${String(count)} ${one}${count === 1 ? "" : "s"}`

export const tableCopy = {
  tool: "Insert table",
  size: "Table size",
  sizeOf: (rows: number, columns: number) => `${counted(rows, "row")}, ${counted(columns, "column")}`,
  cells: "Cells",
} as const
