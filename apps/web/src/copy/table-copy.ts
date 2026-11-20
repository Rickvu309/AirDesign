const counted = (count: number, one: string) => `${String(count)} ${one}${count === 1 ? "" : "s"}`

export const tableCopy = {
  tool: "Insert table",
  size: "Table size",
  sizeOf: (rows: number, columns: number) => `${counted(rows, "row")}, ${counted(columns, "column")}`,
  cells: "Cells",
  cellFill: "Fill",
  textSize: "Size",
  textColor: "Text color",
  bold: "Bold",
  italic: "Italic",
  align: "Align",
  addRow: "Add row",
  addColumn: "Add column",
  insertRow: (row: number) => `Add row below row ${String(row)}`,
  insertColumn: (column: number) => `Add column after column ${String(column)}`,
  row: (row: number) => `Row ${String(row)}`,
  column: (column: number) => `Column ${String(column)}`,
} as const
