import * as doom from "@airdesign/doom"
import {
  accentTick,
  box,
  contentWidth,
  copy,
  frame,
  margin,
  navy,
  pad,
  quiet,
  rowOf,
  shape,
  slideTitle,
  solid,
  white,
} from "../slide-kit.js"

type Site = "t" | "r" | "b" | "l"

const stepBox = (name: string, label: string, props: object = {}, dark = false) =>
  frame(
    name,
    {
      box: box(0, 0, 100, 100),
      sizing: { w: "fill", h: "fixed" },
      fills: [solid(dark ? navy : { var: "accent1", tint: 0.9 })],
      radius: 18,
      layout: rowOf(0, "center-center", pad(0, 24)),
      ...props,
    },
    [
      copy(`${name} label`, label, {
        style: "body2",
        color: dark ? white : navy,
        bold: true,
        align: "center",
        size: 26,
      }),
    ],
  )

const link = (
  name: string,
  from: readonly [string, Site],
  to: readonly [string, Site],
  route: "straight" | "elbow" | "curve",
  arrows: readonly ["none" | "arrow" | "triangle" | "circle", "none" | "arrow" | "triangle" | "circle"] = [
    "none",
    "triangle",
  ],
) =>
  shape(name, (ids) => ({
    geometry: {
      kind: "line",
      start: { node: ids[from[0]]!, site: from[1] },
      end: { node: ids[to[0]]!, site: to[1] },
      route,
      arrows,
    },
    strokes: [solid(navy)],
    stroke: { weight: 4, align: "center", dash: "solid" },
  }))

const sample = (name: string, x: number, arrow: "arrow" | "triangle" | "circle", label: string) => [
  shape(name, {
    geometry: {
      kind: "line",
      start: { x, y: 944 },
      end: { x: x + 200, y: 944 },
      route: "straight",
      arrows: ["none", arrow],
    },
    strokes: [solid(navy)],
    stroke: { weight: 4, align: "center", dash: "solid" },
  }),
  copy(`${name} label`, label, { style: "body2", color: quiet, x: x + 236, y: 926, width: 320, size: 24 }),
]

export function linesArrows(): doom.TreeSlide {
  return {
    name: "Lines and arrows",
    children: [
      accentTick(),
      slideTitle("Connectors stay attached to the shapes they join"),
      frame(
        "steps",
        { box: box(margin, 280, contentWidth, 130), sizing: { w: "fixed", h: "fixed" }, layout: rowOf(120) },
        [
          stepBox("brief", "Brief"),
          stepBox("draft", "Draft"),
          stepBox("review", "Review"),
          stepBox("send", "Send", {}, true),
        ],
      ),
      link("brief to draft", ["brief", "r"], ["draft", "l"], "straight"),
      link("draft to review", ["draft", "r"], ["review", "l"], "straight"),
      link("review to send", ["review", "r"], ["send", "l"], "straight"),
      stepBox("lead", "Programme lead", { box: box(480, 520, 300, 110), sizing: { w: "fixed", h: "fixed" } }, true),
      stepBox("finance", "Finance", { box: box(120, 720, 300, 110), sizing: { w: "fixed", h: "fixed" } }),
      stepBox("product", "Product", { box: box(480, 720, 300, 110), sizing: { w: "fixed", h: "fixed" } }),
      stepBox("people", "People", { box: box(840, 720, 300, 110), sizing: { w: "fixed", h: "fixed" } }),
      link("lead to finance", ["lead", "b"], ["finance", "t"], "elbow", ["none", "arrow"]),
      link("lead to product", ["lead", "b"], ["product", "t"], "elbow", ["none", "arrow"]),
      link("lead to people", ["lead", "b"], ["people", "t"], "elbow", ["none", "arrow"]),
      stepBox("owner", "Owner", { box: box(1200, 520, 300, 110), sizing: { w: "fixed", h: "fixed" } }, true),
      stepBox("result", "Result", { box: box(1500, 720, 300, 110), sizing: { w: "fixed", h: "fixed" } }),
      link("owner to result", ["owner", "r"], ["result", "t"], "curve", ["circle", "triangle"]),
      ...sample("open arrow", margin, "arrow", "Open arrow"),
      ...sample("closed arrow", 720, "triangle", "Closed arrow"),
      ...sample("round end", 1320, "circle", "Round end"),
      copy("page", "15", {
        style: "caption",
        color: quiet,
        align: "right",
        x: margin + contentWidth - 200,
        y: 996,
        width: 200,
      }),
    ],
  }
}
