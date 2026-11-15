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
      description:
        'A JSON table value, {rows: [{from, cells, fills, borders}]}, where each cell is a JSON text value. from names a row the file has, or -1 for a new row; a row left out is deleted. columns lists the file\'s column for each cell, or -1 for a new column, when columns change. fills and borders hold one entry per cell, or null to keep the cell\'s: a fill as stored, such as {"solid":{"scheme":"accent1"}}, and borders as {top, right, bottom, left}, each {fill, width in EMU, dash}.',
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
