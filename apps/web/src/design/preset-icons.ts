import { createLucideIcon } from "lucide-react"

const borderOutline = { x: 4, y: 4, width: 16, height: 16, rx: 3.5, key: "border" }

export const SolidBorder = createLucideIcon("SolidBorder", [["rect", borderOutline]])

export const DashedBorder = createLucideIcon("DashedBorder", [
  ["rect", { ...borderOutline, strokeDasharray: "3.5 2.75" }],
])

export const DottedBorder = createLucideIcon("DottedBorder", [
  ["rect", { ...borderOutline, strokeDasharray: "0 2.75" }],
])

function shadowIcon(name: string, offset: number, width: number, opacity: number, height = 14) {
  return createLucideIcon(name, [
    [
      "rect",
      {
        x: (24 - width) / 2,
        y: 3 + offset,
        width,
        height,
        rx: 3,
        fill: "currentColor",
        stroke: "none",
        opacity,
        key: "shadow",
      },
    ],
    ["rect", { x: 5, y: 3, width: 14, height: 14, rx: 3, fill: "var(--panel-track)", key: "shape" }],
  ])
}

export const SoftShadow = shadowIcon("SoftShadow", 3, 14, 0.35)
export const LiftedShadow = shadowIcon("LiftedShadow", 6, 18, 0.55)
export const GlowShadow = shadowIcon("GlowShadow", -2, 18, 0.45, 18)

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
  ...[0, 1, 2, 3].flatMap((row) =>
    [0, 1, 2, 3]
      .filter((col) => (row + col) % 2 === 0)
      .map((col): ["circle", { cx: number; cy: number; r: number; fill: string; stroke: string; key: string }] => [
        "circle",
        {
          cx: 7 + col * 3.4,
          cy: 7 + row * 3.4,
          r: 1.5 - col * 0.2,
          fill: "currentColor",
          stroke: "none",
          key: `${row}-${col}`,
        },
      ]),
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

export const NoneFill = createLucideIcon("NoneFill", [["path", { d: "M3 12h18", key: "none" }]])

export const ImageFill = createLucideIcon("ImageFill", [
  ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 2, key: "edge" }],
  ["circle", { cx: 17, cy: 7, r: 1.5, key: "sun" }],
  ["path", { d: "M5 16l5-5 6 6", key: "mountain" }],
])

export const Opacity = createLucideIcon("Opacity", [
  ["rect", { x: 3, y: 3, width: 18, height: 18, rx: 3, key: "edge" }],
  [
    "path",
    {
      d: "M16.5 7.5h.01M13.5 10.5h.01M16.5 10.5h.01M10.5 13.5h.01M13.5 13.5h.01M16.5 13.5h.01M7.5 16.5h.01M10.5 16.5h.01M13.5 16.5h.01M16.5 16.5h.01",
      strokeWidth: 1.75,
      key: "dots",
    },
  ],
])

export const fillIcons = {
  none: NoneFill,
  solid: SolidFill,
  gradient: GradientFill,
  pattern: PatternFill,
  image: ImageFill,
} as const
