import { expect, it } from "vitest"
import { sizeLabelCentre, sizeLabelGap, sizeLabelHeight } from "./size-label-place"

const level = [
  { x: 100, y: 50 },
  { x: 300, y: 50 },
  { x: 300, y: 90 },
  { x: 100, y: 90 },
] as const

it("hangs the label centred under an upright frame with a small gap, as Figma does", () => {
  const at = sizeLabelCentre(level, { x: 200, y: 70 })
  expect(at.x).toBeCloseTo(200)
  expect(at.y - sizeLabelHeight / 2 - 90).toBeCloseTo(sizeLabelGap)
  expect(sizeLabelGap).toBeLessThanOrEqual(8)
})

it("keeps the label on the outer side of a frame turned upside down", () => {
  const turned = [level[2], level[3], level[0], level[1]] as const
  const at = sizeLabelCentre(turned, { x: 200, y: 70 })
  expect(at.y).toBeLessThan(50)
})
