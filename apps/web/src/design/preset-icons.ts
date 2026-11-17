import { createLucideIcon } from "lucide-react"

export const DottedBorder = createLucideIcon("DottedBorder", [
  ["rect", { x: 4, y: 4, width: 16, height: 16, rx: 1, strokeDasharray: "1 3", key: "border" }],
])

export const SubtleShadow = createLucideIcon("SubtleShadow", [
  ["path", { d: "M6 18h12V6", strokeWidth: 4, opacity: 0.25, key: "shadow" }],
  ["rect", { x: 3, y: 3, width: 16, height: 16, rx: 1, fill: "var(--muted)", key: "shape" }],
])

export const MediumShadow = createLucideIcon("MediumShadow", [
  [
    "rect",
    { x: 7, y: 7, width: 15, height: 15, rx: 1, fill: "currentColor", stroke: "none", opacity: 0.4, key: "shadow" },
  ],
  ["rect", { x: 3, y: 3, width: 15, height: 15, rx: 1, fill: "var(--muted)", key: "shape" }],
])

export const StrongShadow = createLucideIcon("StrongShadow", [
  [
    "rect",
    { x: 9, y: 9, width: 14, height: 14, rx: 1, fill: "currentColor", stroke: "none", opacity: 0.6, key: "shadow" },
  ],
  ["rect", { x: 2, y: 2, width: 15, height: 15, rx: 1, fill: "var(--muted)", key: "shape" }],
])

export const PatternFill = createLucideIcon("PatternFill", [
  ["rect", { x: 4, y: 3, width: 16, height: 18, rx: 1, key: "edge" }],
  [
    "path",
    {
      d: "M8 7h.01M15 7h.01M11 11h.01M17 13h.01M7 15h.01M12 17h.01M16 18h.01",
      strokeWidth: 2,
      strokeLinecap: "round",
      key: "dots",
    },
  ],
])

export const SolidFill = createLucideIcon("SolidFill", [
  ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, key: "edge" }],
  ["rect", { x: 6, y: 6, width: 12, height: 12, rx: 0.5, fill: "currentColor", fillOpacity: 0.35, key: "fill" }],
])

export const GradientFill = createLucideIcon("GradientFill", [
  ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, key: "edge" }],
  ...[0, 1, 2].flatMap((row) =>
    [0, 1, 2].map(
      (col): ["circle", { cx: number; cy: number; r: number; fill: string; stroke: string; key: string }] => [
        "circle",
        {
          cx: 7 + col * 5,
          cy: 7 + row * 5,
          r: 0.55 + (row + 2 - col) * 0.2,
          fill: "currentColor",
          stroke: "none",
          key: `${row}-${col}`,
        },
      ],
    ),
  ),
])

export const DistributeSpacing = createLucideIcon("DistributeSpacing", [
  ["path", { d: "M3 3h18M3 21h18", opacity: 0.4, key: "edges" }],
  ["path", { d: "M8 12h8", strokeWidth: 3, key: "middle" }],
])

export const AlignLeftEdge = createLucideIcon("AlignLeftEdge", [
  ["path", { d: "M3 3v18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M8 8h12M8 16h6", strokeWidth: 3, key: "bars" }],
])
export const AlignHorizontalCenter = createLucideIcon("AlignHorizontalCenter", [
  ["path", { d: "M12 3v18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M4 8h16M8 16h8", strokeWidth: 3, key: "bars" }],
])
export const AlignRightEdge = createLucideIcon("AlignRightEdge", [
  ["path", { d: "M21 3v18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M4 8h12M10 16h6", strokeWidth: 3, key: "bars" }],
])
export const AlignTopEdge = createLucideIcon("AlignTopEdge", [
  ["path", { d: "M3 3h18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M8 8v12M16 8v6", strokeWidth: 3, key: "bars" }],
])
export const AlignVerticalCenter = createLucideIcon("AlignVerticalCenter", [
  ["path", { d: "M3 12h18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M8 4v16M16 8v8", strokeWidth: 3, key: "bars" }],
])
export const AlignBottomEdge = createLucideIcon("AlignBottomEdge", [
  ["path", { d: "M3 21h18", strokeWidth: 1.5, opacity: 0.4, key: "edge" }],
  ["path", { d: "M8 4v12M16 10v6", strokeWidth: 3, key: "bars" }],
])

export const LineSpacing = createLucideIcon("LineSpacing", [
  ["path", { d: "M3 3h18M3 21h18M6 17l6-11 6 11M8 14h8", key: "spacing" }],
])

export const NoneFill = createLucideIcon("NoneFill", [["path", { d: "M3 12h18", key: "none" }]])
