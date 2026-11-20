import type { TraitWire } from "./trait-wire.js"

const revenue = { kind: "bar", categories: ["Q1", "Q2"], series: [{ name: "Revenue", values: [4.1, 4.6] }] }

export const chartWire: TraitWire<"chart"> = {
  fields: { value: { example: { chart: { value: JSON.stringify(revenue) } } } },
}
