import { expect, it, vi } from "vitest"
import { resolveColor } from "../color.js"
import { defaultTheme, themeLibrary } from "../theme.js"
import { paletteRamp, rampCapacity, rampLightness, rampSlots } from "./palette-ramp.js"
import { contrast, validatorDeltaE } from "./testing/palette-checks.js"

const themes = Object.entries(themeLibrary)

function rampOf(theme: (typeof themeLibrary)["neutral"]["theme"]) {
  return Array.from({ length: 3 }, (_, i) =>
    resolveColor(paletteRamp([i, 3, { var: "accent1" }, { var: "text2" }], theme), theme),
  )
}

it.each(themes)("keeps the accent and every grey 15 OKLab ΔE apart in %s", (_id, { theme }) => {
  const distinct = [...new Set(rampOf(theme))]
  for (const [i, left] of distinct.entries())
    for (const right of distinct.slice(i + 1)) expect(validatorDeltaE(left, right)).toBeGreaterThanOrEqual(15)
})

it.each(themes)("never paints a grey heavier than the accent in %s", (_id, { theme }) => {
  const { accent1, background } = theme.colors
  for (const grey of rampOf(theme).slice(1))
    expect(contrast(grey, background)).toBeLessThanOrEqual(contrast(accent1, background))
})

it.each(themes)("keeps the first grey at or past the contrast floor in %s", (_id, { theme }) => {
  const { accent1, background } = theme.colors
  const [accent, neutral] = rampOf(theme)
  expect(accent).toBe(accent1)
  expect(contrast(neutral!, background)).toBeGreaterThanOrEqual(3)
})

it.each(themes)("keeps every grey at 3:1 on the background in %s", (_id, { theme }) => {
  for (const grey of rampOf(theme).slice(1)) expect(contrast(grey, theme.colors.background)).toBeGreaterThanOrEqual(3)
})

it("finds a second grey only where one meets 3:1 between the first grey and the accent", () => {
  expect(Object.fromEntries(themes.map(([id, { theme }]) => [id, rampCapacity(theme)]))).toEqual({
    consulting: 3,
    editorial: 2,
    midnight: 2,
    neutral: 3,
    technical: 2,
  })
})

it.each(themes)("darkens the second grey from the first when %s has room for it", (_id, { theme }) => {
  const [, first, second] = rampOf(theme)
  if (first === second) return
  expect(Math.abs(rampLightness(second!) - rampLightness(first!))).toBeGreaterThanOrEqual(0.06)
})

it("finds a second grey in at least one built-in theme and not in every one", () => {
  const counts = themes.map(([, { theme }]) => new Set(rampOf(theme)).size)
  expect(counts).toContain(3)
  expect(counts).toContain(2)
})

it.each(themes)("alternates the greys it has and reports what it lacks in %s", (_id, { theme }) => {
  const report = vi.fn()
  const rows = ["a", "b", "c", "d"].map((id) => ({ id }))
  const slots = rampSlots([rows, ["a"]], () => {}, report, theme)
  const capacity = new Set(rampOf(theme)).size
  expect(slots.count).toBe(capacity)
  expect(slots.indices).toEqual(capacity === 3 ? [0, 1, 2, 1] : [0, 1, 1, 1])
  expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "many-series", count: 4, capacity })
})

it.each(themes)("lets labelled marks share greys without a finding in %s", (_id, { theme }) => {
  const report = vi.fn()
  const rows = ["a", "b", "c", "d"].map((id) => ({ id }))
  rampSlots([rows, ["a"], "labelled"], () => {}, report, theme)
  rampSlots([rows, ["c"], "circular"], () => {}, report, theme)
  expect(report).not.toHaveBeenCalled()
})

it.each(themes)("mutes labelled highlights in %s", (_id, { theme }) => {
  const { accent1, background } = theme.colors
  const grey = resolveColor(paletteRamp([1, 2, { var: "accent1" }, { var: "text2" }, true], theme), theme)
  expect(contrast(grey, background)).toBeGreaterThanOrEqual(2.2)
  expect(contrast(grey, background)).toBeLessThan(2.25)
  expect(contrast(grey, accent1)).toBeGreaterThanOrEqual(2)
})

it("reports when the palette needs more distinct colours than it has slots", () => {
  const report = vi.fn()
  const theme = defaultTheme
  paletteRamp([0, 5, { var: "accent1" }, { var: "text2" }, true], theme, report)
  expect(report).toHaveBeenCalledExactlyOnceWith({
    kind: "many-series",
    count: 5,
    capacity: new Set(rampOf(theme)).size,
  })
})
