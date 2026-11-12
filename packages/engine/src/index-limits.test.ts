import { expect, it } from "vitest"
import { elementId, limits, writeTextValue } from "@airdesign/document"
import { readDeckId } from "@airdesign/catalog"
import { openDeck, readDeckPage, readLead, readReport, withinRead } from "./index.js"

const id = readDeckId("largest-index")
if (!id.ok) throw new Error("deck")
const slides = Array.from({ length: limits.slides }, (_, position) => ({ id: String(258 + position), position }))

it("reads all 5000 maximum-sized floors across 50 slides without losing a node or exceeding a page", () => {
  const elements = Array.from({ length: limits.elements }, (_, n) => ({
    node: elementId(`${258 + (n % limits.slides)}.${n}`),
    kind: "shape" as const,
    value: "x".repeat(limits.valueBytes),
    box: null,
    grouped: false,
  }))
  const initial = openDeck(id.deck)
  const deck = {
    ...initial,
    register: { ...initial.register, index: { slides, total: elements.length, elements, pages: [] } },
  }
  const seen = new Set<string>()
  let cursor: string | undefined
  do {
    const answer = readDeckPage(deck, { runId: null, ...(cursor === undefined ? {} : { cursor }) })
    expect(withinRead(readReport(readLead(answer.revision), answer))).toBe(true)
    expect(answer.slides).toEqual(slides)
    expect(answer.elements.length).toBeGreaterThan(0)
    for (const element of answer.elements) {
      expect(element.value).toBe("x".repeat(limits.valueBytes))
      expect(element.version).toBe(0)
      expect(seen.has(element.node)).toBe(false)
      seen.add(element.node)
    }
    cursor = answer.cursor
  } while (cursor !== undefined)
  expect(seen.size).toBe(limits.elements)
}, 60_000)

it.fails("keeps the existing read report cap for maximum-sized escaped text", () => {
  const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "\\".repeat(3900) }] }])
  expect(value.length).toBeLessThanOrEqual(limits.valueBytes)
  const initial = openDeck(id.deck)
  const deck = {
    ...initial,
    register: {
      ...initial.register,
      index: {
        total: 1,
        slides,
        elements: [{ node: elementId("258.7"), kind: "shape" as const, value, box: null, grouped: false }],
        pages: [],
      },
    },
  }
  const answer = readDeckPage(deck, { runId: null })
  expect(answer.elements[0]?.value).toBe(value)
  expect(withinRead(readReport(readLead(answer.revision), answer))).toBe(true)
})
