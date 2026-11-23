import { describe, expect, it } from "vitest"
import { readIndexPage } from "./deck-index.js"
import written from "./format-64-deck.json" with { type: "json" }
import { record } from "./plain-object.js"

describe("what a format 64 device kept", () => {
  const entries = written.device.entries.map((entry) => record(entry.value) ?? {})

  it("reads its cached index page with the template styles under their new keys", () => {
    const kept = entries.find((entry) => entry.once !== undefined && "elements" in entry)
    if (kept === undefined) throw new Error("no index")
    const page = readIndexPage(kept)
    if (page === null) throw new Error("no index")
    expect(page.format).toBe(written.format)
    expect(page.templateStyles).toEqual(kept.templates)
    const slides = kept.slides
    if (!Array.isArray(slides)) throw new Error("no slides")
    expect(page.slides.map((slide) => slide.templateStyle)).toEqual(
      slides.map((slide) => {
        const row = record(slide)
        return row === null || typeof row.template !== "string" ? undefined : row.template
      }),
    )
  })
})
