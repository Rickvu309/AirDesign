import * as doom from "@airdesign/doom"
import { quarterlyChart, rankingChart } from "./chart-marks.js"
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

export function barCharts(): doom.TreeSlide {
  return {
    name: "Bar charts",
    children: [
      accentTick(),
      slideTitle("Enterprise leads every segment in net new revenue"),
      frame("exhibits", { box: box(margin, 288, contentWidth, 660), layout: rowOf(96) }, [
        exhibit("ranking", "Net new revenue by segment, 2025, $M", rankingChart),
        exhibit("quarterly", "Revenue by quarter, 2025, $K", quarterlyChart),
      ]),
      ...footer("Source: Company finance, fiscal year 2025", "9"),
    ],
  }
}
