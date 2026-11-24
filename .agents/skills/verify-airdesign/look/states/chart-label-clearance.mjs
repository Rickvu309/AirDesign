import { openDoomDeck, spot } from "../doom-deck.mjs"

const extremes = {
  labels: true,
  categories: ["Loss", "Zero", "Huge", "Tiny", "Major"],
  series: [{ name: "Sales", values: [-2.5, 0, 987654321012.34, 0.004, 324000000000.25] }],
  unit: "thousand USD",
}

const operatingCost = {
  kind: "stacked",
  labels: true,
  categories: ["Q1", "Q2", "Q3", "Q4"],
  series: [
    { name: "Personnel", values: [460, 585, 510, 620] },
    { name: "Vendor services", values: [210, 234, 268, 271] },
    { name: "Infrastructure", values: [85, 100, 90, 112] },
    { name: "Marketing", values: [98, 110, 124, 132] },
    { name: "General & administrative", values: [120, 142, 150, 147] },
  ],
  unit: "thousand USD",
}

async function drive(kit) {
  const charts = [
    { ...extremes, kind: "line" },
    { ...extremes, kind: "bar" },
    { ...extremes, kind: "column" },
    operatingCost,
  ]
  const slots = [
    [42, 42],
    [978, 42],
    [42, 630],
    [978, 630],
  ]
  await openDoomDeck(
    kit,
    charts.map((chart, at) => ({
      id: `c:${String(at + 1)}`,
      type: "frame",
      props: { box: spot(slots[at][0], slots[at][1], 900, 400), chart },
    })),
  )
}

export default { name: "chart-label-clearance", design: null, drive }
