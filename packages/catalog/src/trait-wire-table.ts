import type { TraitWire } from "./trait-wire.js"

const blank = [{ from: 0, runs: [] }]
const accent = { solid: { scheme: "accent1" } }
const header = {
  from: 0,
  cells: [[{ from: 0, runs: [{ from: -1, text: "Region", bold: true }] }], blank, blank],
  fills: [accent, accent, accent],
  borders: [null, null, { bottom: { fill: accent, width: 25400 } }],
}

export const tableWire: TraitWire<"table"> = {
  description: "The table's rows, columns, cell text, cell fills and cell borders.",
  fields: {
    value: {
      description: "A JSON table value, as the instructions give it.",
      example: {
        table: {
          value: JSON.stringify({
            rows: [header, { from: 1, cells: [blank, blank, blank] }, { from: 2, cells: [blank, blank, blank] }],
          }),
        },
      },
    },
  },
}
