import type { Effect } from "./paint.js"
import type { Theme } from "./theme.js"

const shadow = (y: number, blur: number, opacity: number): Effect => ({
  kind: "dropShadow",
  color: { var: "text" },
  opacity,
  x: 0,
  y,
  blur,
  spread: 0,
})

export const defaultTheme: Theme = {
  colors: {
    text: "#0b1b2b",
    background: "#ffffff",
    text2: "#5b6b7c",
    background2: "#f1f4f8",
    accent1: "#0b3a6f",
    accent2: "#1f9bd1",
    accent3: "#00a88f",
    accent4: "#f2a900",
    accent5: "#e4572e",
    accent6: "#7a5cc0",
    link: "#1f6feb",
  },
  fonts: { heading: "Inter", body: "Inter" },
  textStyles: {
    bigNumber: { size: 96, font: "heading", weight: 700, lineHeight: 1.05, tracking: -1 },
    title: { size: 60, font: "heading", weight: 700, lineHeight: 1.12, tracking: -0.5 },
    heading: { size: 36, font: "heading", weight: 600, lineHeight: 1.2, tracking: 0 },
    body: { size: 28, font: "body", weight: 400, lineHeight: 1.4, tracking: 0 },
    body2: { size: 24, font: "body", weight: 400, lineHeight: 1.4, tracking: 0 },
    caption: { size: 20, font: "body", weight: 400, lineHeight: 1.35, tracking: 0 },
    label: { size: 18, font: "body", weight: 600, lineHeight: 1.2, tracking: 1.4, case: "upper" },
  },
  effectStyles: {
    soft: [shadow(2, 8, 0.08)],
    lifted: [shadow(12, 32, 0.16)],
    glow: [{ kind: "dropShadow", color: { var: "accent2" }, opacity: 0.5, x: 0, y: 0, blur: 28, spread: 0 }],
  },
}
