import { createLucideIcon } from "lucide-react"

export const HorizontalFlow = createLucideIcon("HorizontalFlow", [
  ["path", { d: "M3 4h6v5H3z M14 4h6v5h-6z M3 17h17m-4-4 4 4-4 4", key: "flow" }],
])

export const VerticalFlow = createLucideIcon("VerticalFlow", [
  ["path", { d: "M4 3h5v6H4z M4 14h5v6H4z M17 3v17m-4-4 4 4 4-4", key: "flow" }],
])

export const HorizontalGap = createLucideIcon("HorizontalGap", [
  ["path", { d: "M4 4h2v16H4 m8-12v8 m8-12h-2v16h2", key: "gap" }],
])

export const VerticalGap = createLucideIcon("VerticalGap", [
  ["path", { d: "M4 4v2h16V4 M8 12h8 M4 20v-2h16v2", key: "gap" }],
])

export const HorizontalPadding = createLucideIcon("HorizontalPadding", [
  ["path", { d: "M3 3v18M21 3v18 M9 9h6v6H9z", key: "padding" }],
])

export const VerticalPadding = createLucideIcon("VerticalPadding", [
  ["path", { d: "M3 3h18M3 21h18 M9 9h6v6H9z", key: "padding" }],
])

export const IndividualPadding = createLucideIcon("IndividualPadding", [
  ["path", { d: "M8 4h8 M20 8v8 M8 20h8 M4 8v8", key: "padding" }],
])

export const LeftPadding = createLucideIcon("LeftPadding", [["path", { d: "M3 3v18 M10 9h6v6h-6z", key: "padding" }]])

export const RightPadding = createLucideIcon("RightPadding", [["path", { d: "M21 3v18 M8 9h6v6H8z", key: "padding" }]])

export const TopPadding = createLucideIcon("TopPadding", [["path", { d: "M3 3h18 M9 10h6v6H9z", key: "padding" }]])

export const BottomPadding = createLucideIcon("BottomPadding", [
  ["path", { d: "M3 21h18 M9 8h6v6H9z", key: "padding" }],
])

export const HorizontalLayoutAlignment = createLucideIcon("HorizontalLayoutAlignment", [
  ["path", { d: "M5 6v12 M12 4v16 M19 8v8", strokeWidth: 3, key: "alignment" }],
])

export const VerticalLayoutAlignment = createLucideIcon("VerticalLayoutAlignment", [
  ["path", { d: "M6 5h12 M4 12h16 M8 19h8", strokeWidth: 3, key: "alignment" }],
])
