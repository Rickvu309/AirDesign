import type { PlacementRules } from "@airdesign/doom"

export const placementRules: PlacementRules = {
  gapShare: 0.015,
  padShare: 0.02,
  smallestFreeShare: { w: 0.1, h: 0.05 },
  marginShare: 1 / 12,
  edgeShare: 1 / 13.5,
  freeMarginShare: 0.04,
  strokeReachShare: 0.02,
  iconSide: 96,
  iconStrokeDivisor: 12,
  lineWeight: 3,
  strokeWeight: 2,
  table: {
    name: "Grid",
    ruleName: "Rule",
    totalRow: /^(?:grand\s+)?total\b/iu,
    headerRule: { weight: 2, ink: { kind: "solid", color: { var: "text" } } },
    rowRule: { weight: 1, ink: { kind: "solid", color: { var: "text", tint: 0.8 } } },
  },
}
