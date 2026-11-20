import type { Palette } from "@airdesign/document"
import { expect, it } from "vitest"
import { chartInk } from "./chart-ink.js"

const blank: Palette = {
  slots: {
    dk1: "202020",
    lt1: "FFFFFF",
    dk2: "1F3A5F",
    lt2: "EEF2F6",
    accent1: "2D6FCD",
    accent2: "E07A2E",
    accent3: "2F9E62",
  },
  map: { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" },
}

it("writes a label inside a bar in whichever of the slide's text and background colours reads better on that fill", () => {
  const ink = chartInk(blank)
  expect(ink({ scheme: "accent1" })).toBe("bg1")
  expect(ink({ scheme: "tx2" })).toBe("bg1")
  expect(ink({ scheme: "accent2" })).toBe("tx1")
  expect(ink({ rgb: "BFBFBF" })).toBe("tx1")
  expect(
    ink({
      scheme: "accent1",
      transforms: [
        { op: "lumMod", val: 40000 },
        { op: "lumOff", val: 60000 },
      ],
    }),
  ).toBe("tx1")
  const dark: Palette = { ...blank, map: { bg1: "dk1", tx1: "lt1", bg2: "dk2", tx2: "lt2" } }
  expect(chartInk(dark)({ rgb: "F2F2F2" })).toBe("bg1")
  expect(chartInk(dark)({ rgb: "1F3A5F" })).toBe("tx1")
  expect(chartInk(null)({ scheme: "accent1" })).toBe("tx1")
})
