import { readDeckId, type DeckId, type SlideScreenshots } from "@airdesign/catalog"
import { nodeId } from "@airdesign/doom"
import { describe, expect, it } from "vitest"
import { DeckScreenshots, leaseGrace, viewMemory } from "./deck-screenshots.js"

function deckOf(name: string): DeckId {
  const read = readDeckId(name)
  if (!read.ok) throw new Error(name)
  return read.deck
}

const deck = deckOf("deck")
const slide = nodeId("t:3")
const key = "a".repeat(64)
const painted: SlideScreenshots = { keys: [{ slide, key }], images: [{ slide, key, type: "image/jpeg", data: "QUFB" }] }

describe("a device painter's lease on a deck", () => {
  it("answers a screenshot from a painter that holds a lease, with no editor tab open", async () => {
    const screenshots = new DeckScreenshots()
    const painter = new AbortController()
    const asked = screenshots.lease(deck, painter.signal)
    const taken = screenshots.take(deck, [{ slide, key }], 5_000)
    expect(await asked).toBe(true)
    expect(screenshots.wantedAmong(deck, [slide])).toEqual([slide])
    screenshots.keep(deck, 1, painted)
    expect(await taken).toEqual(new Map([[slide, "QUFB"]]))
    painter.abort()
  })

  it("answers at once that no painter holds the deck when nobody leases it", async () => {
    const screenshots = new DeckScreenshots()
    const started = performance.now()
    expect(await screenshots.take(deck, [{ slide, key }], 60_000)).toBe("no painter")
    expect(performance.now() - started).toBeLessThan(1_000)
    expect(screenshots.wantedAmong(deck, [slide])).toEqual([])
  })

  it("keeps the lease while the painter waits and for a few seconds after it stops", () => {
    let now = 1_000
    const screenshots = new DeckScreenshots(undefined, () => now)
    expect(screenshots.leased(deck)).toBe(false)
    const painter = new AbortController()
    void screenshots.lease(deck, painter.signal)
    now += 60_000
    expect(screenshots.leased(deck)).toBe(true)
    painter.abort()
    now += leaseGrace - 1
    expect(screenshots.leased(deck)).toBe(true)
    now += 1
    expect(screenshots.leased(deck)).toBe(false)
    screenshots.keep(deck, 3, painted)
    expect(screenshots.leased(deck)).toBe(true)
    expect(screenshots.leased(deckOf("other"))).toBe(false)
  })

  it("waits a few seconds for a painter that is opening, then answers from it", async () => {
    const screenshots = new DeckScreenshots()
    const taken = screenshots.take(deck, [{ slide, key }], 5_000, 2_000)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const painter = new AbortController()
    expect(await screenshots.lease(deck, painter.signal)).toBe(true)
    screenshots.keep(deck, 1, painted)
    expect(await taken).toEqual(new Map([[slide, "QUFB"]]))
    painter.abort()
  })

  it("says no painter holds the deck once the opening wait runs out", async () => {
    const screenshots = new DeckScreenshots()
    const started = performance.now()
    expect(await screenshots.take(deck, [{ slide, key }], 60_000, 100)).toBe("no painter")
    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it("remembers for a while that an account's chat shows the deck view", () => {
    let now = 1_000
    const screenshots = new DeckScreenshots(undefined, () => now)
    expect(screenshots.showsViews("a@example.com")).toBe(false)
    screenshots.sawView("a@example.com")
    now += viewMemory - 1
    expect(screenshots.showsViews("a@example.com")).toBe(true)
    expect(screenshots.showsViews("b@example.com")).toBe(false)
    now += 1
    expect(screenshots.showsViews("a@example.com")).toBe(false)
  })
})
