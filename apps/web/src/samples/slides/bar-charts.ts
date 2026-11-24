import * as doom from "@airdesign/doom"
import {
  accentTick,
  box,
  columnOf,
  contentWidth,
  copy,
  footer,
  frame,
  ink,
  margin,
  rowOf,
  slideTitle,
} from "../slide-kit.js"

const exhibit = (name: string, heading: string, chart: doom.TreeNode) =>
  frame(name, { box: box(0, 0, 100, 100), sizing: { w: "fill", h: "fill" }, layout: columnOf(20) }, [
    copy(`${name} heading`, heading, { style: "body", color: ink, bold: true, size: 26 }),
    chart,
  ])

const segments = ["Enterprise", "Mid-market", "Small business", "Public sector", "Partners"]

const ranking = frame("ranking chart", (ids) => ({
  box: box(0, 0, 100, 100),
  sizing: { w: "fill", h: "fill" },
  chart: {
    kind: "bar",
    categories: segments,
    series: [{ name: "Net new revenue", values: [1.9, 1.2, 0.7, 0.5, 0.3], color: { var: "accent1", tint: 0.62 } }],
    labels: true,
    points: { [`${String(ids["ranking chart"])}#Net-new-revenue:Enterprise`]: { var: "accent1" } },
  },
}))

const quarters = frame("quarters chart", {
  box: box(0, 0, 100, 100),
  sizing: { w: "fill", h: "fill" },
  chart: {
    kind: "stacked",
    categories: ["Q1", "Q2", "Q3", "Q4"],
    series: [
      { name: "Existing customers", values: [0.72, 0.8, 0.88, 0.97] },
      { name: "New customers", values: [0.2, 0.24, 0.29, 0.34], color: { var: "accent2" } },
    ],
    labels: true,
  },
})

export function barCharts(): doom.TreeSlide {
  return {
    name: "Bar charts",
    children: [
      accentTick(),
      slideTitle("Enterprise leads every segment in net new revenue"),
      frame("exhibits", { box: box(margin, 288, contentWidth, 660), layout: rowOf(96) }, [
        exhibit("ranking", "Net new revenue by segment, 2025, $M", ranking),
        exhibit("quarterly", "Revenue by quarter, 2025, $M", quarters),
      ]),
      ...footer("Source: Company finance, fiscal year 2025", "9"),
    ],
  }
}
