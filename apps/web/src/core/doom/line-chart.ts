import { doom } from "@airdesign/document"
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
  navy,
  pad,
  quiet,
  rowOf,
  slideTitle,
  solid,
} from "../slide-kit.js"

export function lineChart(): doom.Grown {
  return doom.doomFromTree({
    theme: doom.defaultTheme,
    slides: [
      {
        name: "Line chart",
        children: [
          accentTick(),
          slideTitle("Studio grew fivefold and lifted every other product"),
          frame("exhibits", { box: box(margin, 288, contentWidth, 660), layout: rowOf(80) }, [
            frame("trend", { box: box(0, 0, 100, 100), sizing: { w: "fill", h: "fill" }, layout: columnOf(20) }, [
              copy("trend heading", "Monthly active users by product, thousands", {
                style: "body",
                color: ink,
                bold: true,
                size: 26,
              }),
              frame("users chart", {
                box: box(0, 0, 100, 100),
                sizing: { w: "fill", h: "fill" },
                chart: {
                  kind: "line",
                  categories: ["Q1 24", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25", "Q4 25"],
                  series: [
                    { name: "Studio", values: [18, 22, 27, 35, 44, 58, 73, 94] },
                    { name: "Present", values: [9, 11, 14, 16, 21, 25, 30, 38], color: { var: "accent2" } },
                    { name: "Export", values: [4, 5, 6, 8, 9, 11, 13, 15], color: { var: "accent4" } },
                  ],
                },
              }),
            ]),
            frame(
              "callout",
              {
                box: box(0, 0, 460, 100),
                sizing: { w: "fixed", h: "fill" },
                fills: [solid({ var: "background2" })],
                radius: 24,
                layout: columnOf(20, "top-left", pad(44)),
              },
              [
                copy("callout label", "Studio since Q1 2024", { style: "label", color: quiet }),
                copy("callout number", "5.2x", { style: "bigNumber", color: navy, size: 120 }),
                copy("callout body", "monthly active users, from 18 thousand to 94 thousand", {
                  style: "body2",
                  color: ink,
                  size: 26,
                }),
                frame("callout rule", {
                  box: box(0, 0, 100, 2),
                  sizing: { w: "fill", h: "fixed" },
                  fills: [solid({ var: "text2", tint: 0.7 })],
                }),
                copy("share number", "38%", { style: "bigNumber", color: navy, size: 120 }),
                copy("share body", "of new users arrive from a deck someone sent them", {
                  style: "body2",
                  color: ink,
                  size: 26,
                }),
              ],
            ),
          ]),
          ...footer("Source: Product analytics, quarterly averages", "11"),
        ],
      },
    ],
  })
}
