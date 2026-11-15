import { expect, it } from "vitest"
import { contrast, readableText } from "./contrast.js"

it("picks the theme's light text on a dark fill and its dark text on a light one", () => {
  expect(readableText(["505050"], "202020", "FFFFFF")).toBe("lt1")
  expect(readableText(["2D6FCD"], "202020", "FFFFFF")).toBe("lt1")
  expect(readableText(["EEF2F6"], "202020", "FFFFFF")).toBe("dk1")
  expect(contrast("FFFFFF", "2D6FCD")).toBeGreaterThanOrEqual(4.5)
})

it("reads every colour behind the text and picks the text that stays most readable on the worst one", () => {
  expect(readableText(["000000", "FFFFFF"], "000000", "FFFFFF")).toBe("dk1")
  expect(readableText(["1F3A5F", "2D6FCD"], "202020", "FFFFFF")).toBe("lt1")
  expect(readableText(["FFFF00", "FFFFFF"], "202020", "FFFFFF")).toBe("dk1")
})
