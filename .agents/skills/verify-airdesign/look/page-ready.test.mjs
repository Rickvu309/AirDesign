import { describe, expect, it } from "vitest"
import { pageReady, paintedSignal } from "./page-ready.mjs"

describe("when a page is painted enough to look at", () => {
  it("waits for the Doom editor's painted slide on /s and on a deck at /s/<id>", () => {
    expect(paintedSignal("/s")).toBe("[data-editor-ready]")
    expect(paintedSignal("/s/abc123")).toBe("[data-editor-ready]")
    expect(paintedSignal("/s?x=1")).toBe("[data-editor-ready]")
  })

  it("leaves every other page to the settle step", () => {
    expect(paintedSignal("/")).toBeNull()
    expect(paintedSignal("/screens/sample-01-title-slide")).toBeNull()
    expect(paintedSignal("/settings")).toBeNull()
    expect(paintedSignal("/deck/abc")).toBeNull()
  })

  it("asks the page for the signal only when there is one", async () => {
    const asked = []
    const page = {
      locator: (selector) => ({
        first: () => ({
          waitFor: async (options) => {
            asked.push([selector, options.state])
          },
        }),
      }),
    }
    await pageReady(page, "/s/abc")
    await pageReady(page, "/deck/abc")
    expect(asked).toEqual([["[data-editor-ready]", "attached"]])
  })
})
