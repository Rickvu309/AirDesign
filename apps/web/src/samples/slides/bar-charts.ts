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

const exhibit = (name: string, heading: string) =>
  frame(name, { box: box(0, 0, 100, 100), sizing: { w: "fill", h: "fill" }, layout: columnOf(20) }, [
    copy(`${name} heading`, heading, { style: "body", color: ink, bold: true, size: 26 }),
  ])

const categories = (labels: readonly string[]) => labels.map((label, index) => ({ id: `c${index + 1}`, label }))
const chartBox = { x: 0, y: 55, w: (contentWidth - 96) / 2, h: 604 }
const series = [
  { id: "existing", label: "Existing customers" },
  { id: "new", label: "New customers" },
]

export const barChartComponents = [
  {
    parent: "ranking",
    component: "clustered-chart",
    variant: { orientation: "bar" },
    box: chartBox,
    data: {
      categories: categories(["Enterprise", "Mid-market", "Small business", "Public sector", "Partners"]),
      series: [
        {
          id: "revenue",
          label: "Net new revenue",
          values: [1.9, 1.2, 0.7, 0.5, 0.3],
          fills: ["accent1", "accent1+62", "accent1+62", "accent1+62", "accent1+62"],
        },
      ],
    },
  },
  {
    parent: "quarterly",
    component: "stacked",
    box: chartBox,
    data: {
      categories: categories(["Q1", "Q2", "Q3", "Q4"]),
      series,
      segments: [
        [0.72, 0.2],
        [0.8, 0.24],
        [0.88, 0.29],
        [0.97, 0.34],
      ].flatMap((values, index) =>
        series.map(({ id: seriesId }, at) => ({
          id: `c${index + 1}-${seriesId}`,
          category: `c${index + 1}`,
          series: seriesId,
          value: values[at]!,
        })),
      ),
    },
  },
]

export function barCharts(): doom.TreeSlide {
  return {
    name: "Bar charts",
    children: [
      accentTick(),
      slideTitle("Enterprise leads every segment in net new revenue"),
      frame("exhibits", { box: box(margin, 288, contentWidth, 660), layout: rowOf(96) }, [
        exhibit("ranking", "Net new revenue by segment, 2025, $M"),
        exhibit("quarterly", "Revenue by quarter, 2025, $M"),
      ]),
      ...footer("Source: Company finance, fiscal year 2025", "9"),
    ],
  }
}
