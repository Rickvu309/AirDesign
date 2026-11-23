import { describe, expect, it } from "vitest"
import { readIndexPage } from "./deck-index.js"
import written from "./format-58-deck.json" with { type: "json" }
import { record } from "./plain-object.js"

describe("what a format 58 device kept", () => {
  const entries = written.device.entries.map((entry) => record(entry.value) ?? {})

  it("reads its cached index page with border design", () => {
    const page = readIndexPage(entries.find((entry) => entry.once !== undefined && "elements" in entry))
    expect(page?.format).toBe(written.format)
    const keys = (page?.elements ?? []).flatMap((element) => Object.keys(element.design ?? {}))
    expect(keys.filter((key) => key.startsWith("border."))).toHaveLength(6)
    expect(keys.filter((key) => key.startsWith("line."))).toEqual([])
  })
})
