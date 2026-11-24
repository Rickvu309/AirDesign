import type { AgentChart } from "./agent-chart.js"
import type { Chart } from "./chart.js"

type Sample = Chart & AgentChart

const samples: Readonly<Record<Chart["kind"], Sample>> = {
  column: {
    kind: "column",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [{ name: "Revenue", values: [12, 19, 15, 24] }],
    labels: true,
  },
  bar: {
    kind: "bar",
    categories: ["North", "South", "East", "West"],
    series: [{ name: "Revenue", values: [24, 15, 19, 12] }],
    labels: true,
  },
  line: {
    kind: "line",
    categories: ["Jan", "Feb", "Mar", "Apr", "May"],
    series: [{ name: "Users", values: [8, 12, 11, 17, 21] }],
  },
  pie: {
    kind: "pie",
    categories: ["Direct", "Partners", "Online", "Other"],
    series: [{ name: "Share", values: [45, 25, 20, 10] }],
    labels: true,
  },
  stacked: {
    kind: "stacked",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "Product", values: [8, 11, 9, 14] },
      { name: "Services", values: [4, 8, 6, 10] },
    ],
  },
}

export const sampleChart = (kind: Chart["kind"]): Sample => samples[kind]
