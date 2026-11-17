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
