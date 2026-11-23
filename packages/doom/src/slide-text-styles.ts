import type { TextStyleName } from "./text.js"
import type { TextStyle } from "./theme.js"

export const slideTextStyles: Readonly<Record<TextStyleName, TextStyle>> = {
  bigNumber: { size: 160, font: "heading", weight: 700, lineHeight: 1, tracking: -3 },
  title: { size: 88, font: "heading", weight: 700, lineHeight: 1.1, tracking: -1.5 },
  heading: { size: 64, font: "heading", weight: 600, lineHeight: 1.15, tracking: 0 },
  body: { size: 48, font: "body", weight: 400, lineHeight: 1.3, tracking: 0 },
  body2: { size: 40, font: "body", weight: 400, lineHeight: 1.3, tracking: 0 },
  caption: { size: 36, font: "body", weight: 400, lineHeight: 1.3, tracking: 0 },
  label: { size: 36, font: "body", weight: 600, lineHeight: 1.2, tracking: 0.5 },
}
