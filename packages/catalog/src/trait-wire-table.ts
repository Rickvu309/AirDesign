import type { TraitWire } from "./trait-wire.js"

const blank = [{ from: 0, runs: [] }]
const header = { from: 0, cells: [[{ from: 0, runs: [{ from: -1, text: "Region", bold: true }] }], blank] }

export const tableWire: TraitWire<"table"> = {
  fields: {
    value: { example: { table: { value: JSON.stringify({ rows: [header, { from: 1, cells: [blank, blank] }] }) } } },
  },
}
