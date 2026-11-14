import type { TraitWire } from "./trait-wire.js"

export const tableWire: TraitWire<"table"> = {
  description: "The table's rows, columns and cell text.",
  fields: {
    value: {
      description:
        "A JSON table value, {rows: [{from, cells}]}, where each cell is a JSON text value. from names a row the file has, or -1 for a new row; a row left out is deleted. columns lists the file's column for each cell, or -1 for a new column, when columns change.",
      example: { table: { value: '{"rows":[{"from":0,"cells":[[{"from":0,"runs":[{"from":0,"text":"Region"}]}]]}]}' } },
    },
  },
}
