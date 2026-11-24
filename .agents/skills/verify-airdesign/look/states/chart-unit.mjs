import { openDoomDeck, spot } from "../doom-deck.mjs"

async function drive(kit) {
  await openDoomDeck(kit, [
    {
      id: "c:1",
      type: "frame",
      props: {
        name: "Revenue by quarter",
        box: spot(120, 730, 880, 310),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        chart: {
          kind: "column",
          categories: ["Q1", "Q2", "Q3", "Q4"],
          series: [{ name: "Revenue", values: [12, 19, 15, 24] }],
          labels: true,
          unit: "$M",
        },
      },
    },
    {
      id: "c:2",
      type: "frame",
      props: {
        name: "Revenue by segment",
        box: spot(1040, 730, 760, 310),
        fills: [{ kind: "solid", color: { var: "background2" } }],
        chart: {
          kind: "pie",
          categories: ["Direct", "Partners", "Online"],
          series: [{ name: "Revenue", values: [45, 25, 30] }],
          labels: true,
          unit: "$M",
        },
      },
    },
  ])
}

export default { name: "chart-unit", design: null, drive }
