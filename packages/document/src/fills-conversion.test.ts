import { describe, expect, it } from "vitest"
import { readIndexPage } from "./deck-index.js"
import written from "./format-53-deck.json" with { type: "json" }

describe("what a format 53 device kept", () => {
  it("reads its cached index page, and a page whose picture fill is kept, under fills", () => {
    const page = readIndexPage(written.device.indexPage)
    expect(page?.format).toBe(53)
    expect(page?.elements.flatMap((element) => Object.keys(element.design ?? {}))).not.toContain("fill")
    const kept = readIndexPage(written.keptPage)?.elements.find((element) => element.kept?.includes("fills"))
    expect(kept?.kept).toEqual(["fills"])
    expect(kept?.design?.fills).toEqual(["image"])
  })
})
