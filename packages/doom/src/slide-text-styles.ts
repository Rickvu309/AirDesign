import type { TextStyleName } from "./text.js"
import type { TextStyle } from "./theme.js"

export const slideTextStyles: Readonly<Record<TextStyleName, TextStyle>> = {
  bigNumber: { size: 80, font: "heading", weight: 700, lineHeight: 1, tracking: -1.5 },
  title: { size: 56, font: "heading", weight: 700, lineHeight: 1.1, tracking: -1 },
  heading: { size: 40, font: "heading", weight: 600, lineHeight: 1.2, tracking: 0 },
  body: { size: 32, font: "body", weight: 400, lineHeight: 1.35, tracking: 0 },
  body2: { size: 28, font: "body", weight: 400, lineHeight: 1.35, tracking: 0 },
  caption: { size: 24, font: "body", weight: 400, lineHeight: 1.3, tracking: 0 },
  label: { size: 24, font: "body", weight: 600, lineHeight: 1.2, tracking: 0.5 },
}
