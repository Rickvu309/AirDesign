import { openDoomDeck, spot } from "../doom-deck.mjs"

const quarters = ["Q1", "Q2", "Q3", "Q4"]

const budget = [
  "Employee salaries",
  "Contractor fees",
  "Software subscriptions",
  "Hosting and storage",
  "Insurance premiums",
  "Customer acquisition",
  "Facilities and travel",
  "Professional services",
].map((name, at) => ({ name, values: [80 + at * 8, 130 + at * 7, 90 + at * 11, 112 + at * 12] }))

const recycling = {
  kind: "pie",
  labels: true,
  unit: "kg",
  categories: [
    "Glass bottles",
    "Cardboard boxes",
    "Corrugated paper",
    "Plastic containers",
    "Plastic film",
    "Aluminum cans",
    "Steel cans",
    "Newspaper",
    "Office paper",
    "Clear glass",
    "Mixed glass",
    "Other materials",
  ],
  series: [{ name: "Recycling", values: [15, 12, 10, 8, 4, 6, 5, 3, 8, 12, 7, 10] }],
}

const spend = (kind) => ({ kind, labels: true, categories: quarters, series: budget, unit: "thousand USD" })

async function drive(kit) {
  const charts = [
    spend("line"),
    spend("column"),
    spend("stacked"),
    spend("bar"),
    recycling,
    {
      kind: "column",
      labels: true,
      categories: quarters,
      series: [{ name: "Revenue", values: [10, 20, 30, 40] }],
      unit: "₹",
    },
  ]
  await openDoomDeck(
    kit,
    charts.map((chart, at) => ({
      id: `c:${String(at + 1)}`,
      type: "frame",
      props: { box: spot(80 + (at % 3) * 640, 40 + Math.floor(at / 3) * 640, 480, 360), chart },
    })),
  )
}

export default { name: "chart-compact", design: null, drive }
