import * as doom from "@airdesign/doom"
import {
  accentTick,
  box,
  columnOf,
  contentWidth,
  copy,
  footer,
  frame,
  green,
  ink,
  margin,
  navy,
  pad,
  quiet,
  rowOf,
  sky,
  slideTitle,
  solid,
  tile,
} from "../slide-kit.js"

const kpi = (name: string, label: string, value: string, change: string) =>
  tile(name, {}, [
    copy(`${name} label`, label, { style: "label", color: quiet }),
    copy(`${name} value`, value, { style: "title", color: navy }),
    copy(`${name} change`, change, { style: "caption", color: green, bold: true }),
  ])

export function kpiRow(): doom.TreeSlide {
  return {
    name: "KPI row",
    children: [
      accentTick(),
      slideTitle("Revenue grew 12% while gross margin held at 31%"),
      frame("kpis", { box: box(margin, 304, contentWidth, 100), sizing: { w: "fixed", h: "hug" }, layout: rowOf(32) }, [
        kpi("revenue", "Revenue", "$4.2M", "+12% vs 2024"),
        kpi("margin", "Gross margin", "31%", "+0.4 pts vs 2024"),
        kpi("customers", "New customers", "218", "+34 net new"),
        kpi("churn", "Logo churn", "2.1%", "-0.6 pts vs 2024"),
      ]),
      frame("insight", { box: box(margin, 680, 1240, 100), sizing: { w: "fixed", h: "hug" }, layout: rowOf(36) }, [
        frame("bar", { box: box(0, 0, 8, 100), sizing: { w: "fixed", h: "fill" }, fills: [solid(sky)], radius: 4 }),
        frame(
          "words",
          {
            box: box(0, 0, 100, 100),
            sizing: { w: "fill", h: "hug" },
            layout: columnOf(12, "top-left", pad(4, 0)),
          },
          [
            copy("insight heading", "Growth came from existing accounts", {
              style: "heading",
              color: ink,
              size: 34,
            }),
            copy(
              "insight body",
              "Expansion revenue rose 19% as customers moved to multi-year plans. New logos added 5 points of growth, and every quarter closed above plan.",
              { style: "body", color: quiet, size: 26 },
            ),
          ],
        ),
      ]),
      ...footer("Source: Company finance, fiscal years 2024 and 2025", "4"),
    ],
  }
}
